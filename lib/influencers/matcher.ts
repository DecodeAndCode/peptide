import "server-only";
import { z } from "zod";
import { getDashboardContext } from "@/lib/brands";
import { discoverWithPerplexity } from "@/lib/influencers/providers/perplexity";
import { discoverWithOpenAiAndSocialFetch, discoverWithStaticPoolAndSocialFetch } from "@/lib/influencers/providers/socialfetch-discovery";
import { fetchSocialFetchProfile } from "@/lib/influencers/providers/socialfetch-client";
import type {
  DiscoveryCandidate,
  InfluencerProviderContext,
  ProviderCandidateHit,
} from "@/lib/influencers/providers/types";
import { queryOpenAi } from "@/lib/llm/openai";
import {
  getInfluencerDiscoveryBackend,
  isPerplexityConfigured,
  isSocialFetchConfigured,
  shouldUsePerplexityForInfluencerDiscovery,
  shouldUseStaticInfluencerHandlePool,
  shouldVerifyPerplexityCandidatesWithSocialFetch,
} from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getTierAnalysisConfig, getIndustryLabel } from "@/lib/suppgo";
import type {
  BrandRecord,
  CycleRecord,
  InfluencerFollowerRange,
  InfluencerMatchRecord,
  InfluencerPlatform,
  PromptRecord,
  SiteAnalysisRecord,
} from "@/types";

const scoredSchema = z.array(
  z.object({
    handle: z.string().trim().min(1),
    platform: z.enum(["instagram", "tiktok"]),
    display_name: z.string().trim().min(1).optional().nullable(),
    recommended_follower_tier: z.enum(["micro_10k_50k", "mid_50k_200k", "macro_200k+"]),
    niche_tags: z.array(z.string().trim().min(1)).min(1).max(5),
    match_reason: z.string().trim().min(10).max(320),
    outreach_message: z.string().trim().min(20).max(1200),
    fit_score: z.number().min(1).max(10).optional().default(5),
  }),
);

interface ScoredCandidate extends DiscoveryCandidate {
  displayName: string | null;
  followerRange: InfluencerFollowerRange;
  nicheTags: string[];
  matchReason: string;
  outreachMessage: string;
  fitScore: number;
}

const MIN_INFLUENCER_FOLLOWERS = 3_000;
const MIN_VERIFICATION_CONFIDENCE = 70;
const INFLUENCER_COOLDOWN_CYCLES = 3;
const MAX_INFLUENCER_MATCHES_SAVED_PER_CYCLE = 3;

export interface InfluencerPageData {
  brand: BrandRecord;
  latestCompletedCycle: CycleRecord | null;
  matches: InfluencerMatchRecord[];
  topMatches: InfluencerMatchRecord[];
}

const INDUSTRY_NICHE_GUIDANCE: Record<string, string[]> = {
  nootropics_cognitive: ["biohacking", "productivity", "men's optimization", "neuroscience"],
  greens_superfoods: ["clean eating", "gut health", "pilates", "longevity"],
  adaptogens: ["stress management", "holistic wellness", "functional medicine", "women's wellness"],
  peptides_topical_cosmetic: ["anti-aging skincare", "aesthetics", "looksmaxxing", "dermatology"],
  protein_performance: ["fitness", "gym", "strength training", "female athletes"],
  sleep_recovery: ["sleep optimization", "biohacking", "mental health", "women 35-50"],
  vitamins_minerals: ["wellness", "daily health", "healthy aging", "nutrition"],
  weight_management: ["metabolism", "appetite support", "fitness", "women's wellness"],
  gut_health: ["digestive wellness", "microbiome", "clean eating", "longevity"],
  womens_health: ["women's wellness", "hormone health", "healthy aging", "holistic wellness"],
  mens_health: ["men's optimization", "fitness", "biohacking", "healthy aging"],
  general_wellness: ["wellness", "longevity", "daily health", "healthy habits"],
};

function logInfluencerError(
  stage: string,
  error: unknown,
  meta: Record<string, string | number | boolean | null | undefined> = {},
) {
  console.error("[influencer-matcher]", {
    stage,
    message: error instanceof Error ? error.message : "Unknown error",
    ...meta,
  });
}

function stripMarkdownCodeFence(value: string) {
  return value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function normalizeHandle(value: string) {
  return value.replace(/^@+/, "").trim().toLowerCase();
}

function dedupeStrings(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function parseFollowerEstimate(value: string) {
  const trimmed = value.trim().toLowerCase().replace(/,/g, "");
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/\+/g, "")
    .replace(/\bfollowers?\b/gi, "")
    .trim();

  const match = normalized.match(/(\d+(?:\.\d+)?)\s*([kmb])?/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }

  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : suffix === "k" ? 1_000 : 1;

  return Math.round(amount * multiplier);
}

function extractHandleFromProfileUrl(platform: InfluencerPlatform, value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    const pathSegments = url.pathname.split("/").filter(Boolean);

    if (platform === "instagram" && host.endsWith("instagram.com")) {
      return normalizeHandle(pathSegments[0] ?? "");
    }

    if (platform === "tiktok" && host.endsWith("tiktok.com")) {
      const firstSegment = pathSegments[0] ?? "";
      return normalizeHandle(firstSegment.startsWith("@") ? firstSegment.slice(1) : firstSegment);
    }

    return null;
  } catch {
    return null;
  }
}

function getMatchingProfileUrls(platform: InfluencerPlatform, handle: string, urls: string[]) {
  return dedupeStrings(
    urls.filter((url) => extractHandleFromProfileUrl(platform, url) === normalizeHandle(handle)),
  );
}

function parseJsonArray<T>(value: string, schema: z.ZodSchema<T>) {
  try {
    const parsed = JSON.parse(stripMarkdownCodeFence(value));
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function dedupe<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function inferFollowerRange(siteAnalysis: SiteAnalysisRecord | null): InfluencerFollowerRange {
  const signalCount =
    (siteAnalysis?.content_signals?.productNames?.length ?? 0) +
    (siteAnalysis?.content_signals?.healthClaims?.length ?? 0) +
    (siteAnalysis?.content_signals?.faqTopics?.length ?? 0);

  if (signalCount >= 18) {
    return "macro_200k+";
  }

  if (signalCount >= 10) {
    return "mid_50k_200k";
  }

  return "micro_10k_50k";
}

function normalizeFollowerRange(value: string, fallback: InfluencerFollowerRange): InfluencerFollowerRange {
  const normalized = value.toLowerCase();
  const parsedCount = parseFollowerEstimate(value);

  if (parsedCount !== null) {
    if (parsedCount >= 200_000) {
      return "macro_200k+";
    }

    if (parsedCount >= 50_000) {
      return "mid_50k_200k";
    }

    if (parsedCount >= MIN_INFLUENCER_FOLLOWERS) {
      return "micro_10k_50k";
    }
  }

  if (normalized.includes("macro") || normalized.includes("200k")) {
    return "macro_200k+";
  }

  if (normalized.includes("mid") || normalized.includes("50k")) {
    return "mid_50k_200k";
  }

  if (normalized.includes("micro") || normalized.includes("10k")) {
    return "micro_10k_50k";
  }

  return fallback;
}

function getProfileUrl(platform: InfluencerPlatform, handle: string) {
  return platform === "instagram"
    ? `https://www.instagram.com/${handle}`
    : `https://www.tiktok.com/@${handle}`;
}

function validateDiscoveryCandidate(hit: ProviderCandidateHit) {
  const { handle, platform, followerEstimate, topics, sourceUrl, citationUrls } = hit;
  const normalizedHandle = normalizeHandle(handle);
  if (!normalizedHandle) {
    return null;
  }

  const evidenceUrls = dedupeStrings([sourceUrl ?? "", ...citationUrls]);
  const matchingProfileUrls = getMatchingProfileUrls(platform, normalizedHandle, evidenceUrls);

  if (matchingProfileUrls.length === 0) {
    return null;
  }

  const parsedFollowerCount = parseFollowerEstimate(followerEstimate);
  if (parsedFollowerCount === null || parsedFollowerCount < MIN_INFLUENCER_FOLLOWERS) {
    return null;
  }

  const trimmedSource = sourceUrl?.trim() ?? "";
  const sourceUrlMatchesProfile =
    trimmedSource.length > 0 &&
    getMatchingProfileUrls(platform, normalizedHandle, [trimmedSource]).length > 0;

  const citationMatchesProfile = citationUrls.some(
    (url) => getMatchingProfileUrls(platform, normalizedHandle, [url]).length > 0,
  );

  const confidence = Math.min(
    100,
    58 +
      (sourceUrlMatchesProfile ? 14 : 0) +
      (citationMatchesProfile ? 12 : 0) +
      Math.min(10, matchingProfileUrls.length * 5) +
      Math.min(6, topics.length > 0 ? 6 : 0),
  );

  return {
    handle: normalizedHandle,
    platform,
    followerEstimate,
    topics: topics.slice(0, 5),
    sourceUrls: matchingProfileUrls,
    verificationStatus:
      confidence >= MIN_VERIFICATION_CONFIDENCE ? ("grounded" as const) : ("low_confidence" as const),
    verificationConfidence: confidence,
  };
}

async function verifyDiscoveryCandidatesWithSocialFetch(
  candidates: DiscoveryCandidate[],
  minFollowers: number,
): Promise<DiscoveryCandidate[]> {
  const verified: DiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    const profile = await fetchSocialFetchProfile(candidate.platform, candidate.handle);
    if (!profile) {
      continue;
    }

    if (profile.followerCount === null || profile.followerCount < minFollowers) {
      continue;
    }

    const followerEstimate = profile.followerCount.toLocaleString();

    verified.push({
      ...candidate,
      followerEstimate,
      topics: candidate.topics,
      verificationStatus: "grounded",
      verificationConfidence: Math.min(
        100,
        Math.max(candidate.verificationConfidence, 88),
      ),
    });
  }

  return verified;
}

function getBrandNicheTags(brand: BrandRecord) {
  return Array.from(
    new Set(
      brand.industry_tags.flatMap((tag) => INDUSTRY_NICHE_GUIDANCE[tag] ?? [getIndustryLabel(tag).toLowerCase()]),
    ),
  ).slice(0, 8);
}

function getGapPrompts(prompts: PromptRecord[]) {
  return prompts
    .filter((prompt) => !prompt.brand_mentioned)
    .sort((left, right) => (right.competitors_mentioned?.length ?? 0) - (left.competitors_mentioned?.length ?? 0))
    .slice(0, 4)
    .map((prompt) => prompt.prompt_text);
}

function getFallbackGapContext(siteAnalysis: SiteAnalysisRecord | null, industryTags: string[]) {
  const fromSite = dedupeStrings([
    ...(siteAnalysis?.missing_content_gaps ?? []),
    ...(siteAnalysis?.recommendations ?? []),
    ...(siteAnalysis?.content_signals?.topicKeywords ?? []),
    ...(siteAnalysis?.content_signals?.faqTopics ?? []),
  ]);

  if (fromSite.length > 0) {
    return fromSite.slice(0, 4);
  }

  const fromIndustry = dedupeStrings(
    industryTags.flatMap((tag) => INDUSTRY_NICHE_GUIDANCE[tag] ?? [getIndustryLabel(tag).toLowerCase()]),
  );

  return fromIndustry.slice(0, 4);
}

function dedupeCandidates(candidates: DiscoveryCandidate[]) {
  return dedupe(
    candidates.filter((candidate) => Boolean(candidate.handle)),
    (candidate) => `${candidate.platform}:${candidate.handle}`,
  );
}

function rankScoredMatches(matches: ScoredCandidate[]) {
  return [...matches].sort((left, right) => {
    if (right.fitScore !== left.fitScore) {
      return right.fitScore - left.fitScore;
    }

    if (right.verificationConfidence !== left.verificationConfidence) {
      return right.verificationConfidence - left.verificationConfidence;
    }

    return left.handle.localeCompare(right.handle);
  });
}

async function discoverInfluencersWithProviders(
  context: InfluencerProviderContext,
): Promise<{ candidates: DiscoveryCandidate[]; discoveryHint?: string }> {
  if (shouldUsePerplexityForInfluencerDiscovery()) {
    if (!isPerplexityConfigured()) {
      console.warn("[influencer-matcher]", { stage: "perplexity_unconfigured" });
      return {
        candidates: [],
        discoveryHint:
          "PERPLEXITY_API_KEY is not set. Add your Perplexity API key to .env.local and restart the dev server (or set it in your production environment). Without it, the default influencer discovery path cannot run.",
      };
    }

    const rawPerplexityHits = await discoverWithPerplexity(context);
    const validatedFromPerplexity = rawPerplexityHits
      .map(validateDiscoveryCandidate)
      .filter((item): item is DiscoveryCandidate => Boolean(item));
    if (rawPerplexityHits.length > 0 && validatedFromPerplexity.length === 0) {
      console.warn("[influencer-matcher]", {
        stage: "perplexity_hits_all_filtered",
        rawCount: rawPerplexityHits.length,
      });
    }
    const deduped = dedupeCandidates(validatedFromPerplexity);

    let candidatesOut = deduped;

    if (shouldVerifyPerplexityCandidatesWithSocialFetch() && candidatesOut.length > 0) {
      const verified = await verifyDiscoveryCandidatesWithSocialFetch(candidatesOut, MIN_INFLUENCER_FOLLOWERS);
      if (verified.length === 0) {
        return {
          candidates: [],
          discoveryHint:
            "Perplexity suggested creators, but SocialFetch could not confirm live profiles or follower counts met the minimum. Check SOCIALFETCH_API_KEY and credits, or set SUPPGO_INFLUENCER_VERIFY_WITH_SOCIALFETCH=false to skip this step (less reliable).",
        };
      }
      candidatesOut = verified;
    }

    if (candidatesOut.length === 0 && rawPerplexityHits.length > 0) {
      return {
        candidates: [],
        discoveryHint:
          "Perplexity returned names that failed SuppGo checks. Each creator needs (1) a canonical profile URL in source_url or in cited links that matches the handle — instagram.com/{handle} or tiktok.com/@{handle} — and (2) follower_estimate parseable as at least 3,000 (e.g. 8500, 12k, 1.2M). Enable SUPPGO_INFLUENCER_VERIFY_WITH_SOCIALFETCH=true plus SOCIALFETCH_API_KEY to require live profile confirmation.",
      };
    }

    return { candidates: candidatesOut };
  }

  if (!isSocialFetchConfigured()) {
    console.warn("[influencer-matcher]", {
      stage: "discovery_skipped",
      reason:
        "SocialFetch is not configured (SOCIALFETCH_API_KEY). Set the key for the legacy SocialFetch discovery path, or remove SUPPGO_INFLUENCER_USE_SOCIALFETCH_DISCOVERY to use the default Perplexity path.",
    });
    return {
      candidates: [],
      discoveryHint:
        "SocialFetch is not configured. For default discovery, remove SUPPGO_INFLUENCER_USE_SOCIALFETCH_DISCOVERY and set PERPLEXITY_API_KEY. For legacy verification, set SOCIALFETCH_API_KEY in .env.local.",
    };
  }

  if (shouldUseStaticInfluencerHandlePool()) {
    const { candidates: fromPool, hint } = await discoverWithStaticPoolAndSocialFetch(context);
    return { candidates: dedupeCandidates(fromPool), discoveryHint: hint };
  }

  const { candidates: fromApi, hint } = await discoverWithOpenAiAndSocialFetch(context);
  return { candidates: dedupeCandidates(fromApi), discoveryHint: hint };
}

function buildFallbackOutreachMessage({
  brand,
  candidate,
}: {
  brand: BrandRecord;
  candidate: DiscoveryCandidate;
}) {
  const topic = candidate.topics[0] ?? "wellness education";
  return [
    `Hi @${candidate.handle} - I lead partnerships for ${brand.brand_name}.`,
    `I came across your content around ${topic} and think your audience overlaps with the topics we focus on.`,
    "If you're open to it, I'd love to share a product angle that could fit naturally with the conversations you already lead.",
    "Happy to send details if it feels relevant.",
  ].join(" ");
}

function fallbackScoreCandidates({
  brand,
  candidates,
  siteAnalysis,
}: {
  brand: BrandRecord;
  candidates: DiscoveryCandidate[];
  siteAnalysis: SiteAnalysisRecord | null;
}) {
  const brandNiches = getBrandNicheTags(brand);
  const fallbackFollowerRange = inferFollowerRange(siteAnalysis);

  return candidates.map((candidate) => {
    const lowerTopics = candidate.topics.map((topic) => topic.toLowerCase());
    const overlapCount = brandNiches.filter((niche) =>
      lowerTopics.some((topic) => topic.includes(niche.toLowerCase()) || niche.toLowerCase().includes(topic)),
    ).length;
    const fitScore = Math.max(4, Math.min(10, 5 + overlapCount));

    return {
      ...candidate,
      displayName: `@${candidate.handle}`,
      followerRange: normalizeFollowerRange(candidate.followerEstimate, fallbackFollowerRange),
      nicheTags: candidate.topics.slice(0, 4),
      matchReason:
        overlapCount > 0
          ? `@${candidate.handle} overlaps ${brand.brand_name}'s space on ${candidate.topics.slice(0, 2).join(" & ") || "category-relevant themes"}.`
          : `@${candidate.handle} reaches adjacent wellness/fitness audiences where ${brand.brand_name} could add a credible angle.`,
      outreachMessage: buildFallbackOutreachMessage({ brand, candidate }),
      fitScore,
    };
  });
}

async function scoreCandidatesWithOpenAi({
  brand,
  candidates,
  prompts,
  siteAnalysis,
}: {
  brand: BrandRecord;
  candidates: DiscoveryCandidate[];
  prompts: PromptRecord[];
  siteAnalysis: SiteAnalysisRecord | null;
}) {
  const brandNiches = getBrandNicheTags(brand);
  const gapPrompts = getGapPrompts(prompts);
  const fallbackGapContext = getFallbackGapContext(siteAnalysis, brand.industry_tags);
  const gapContext = gapPrompts.length > 0 ? gapPrompts : fallbackGapContext;
  const fallbackFollowerRange = inferFollowerRange(siteAnalysis);

  try {
    const response = await queryOpenAi(
      [
        "You are validating influencer matches for brand partnerships. Each input candidate was surfaced from web search; cross-check handle, platform, follower_estimate, topics, and sourceUrls for internal consistency before scoring.",
        `Brand: ${brand.brand_name}`,
        `Industry tags: ${brand.industry_tags.map(getIndustryLabel).join(", ") || "Unknown"}`,
        `Hero products: ${siteAnalysis?.content_signals?.productNames?.slice(0, 6).join(", ") || "Unknown"}`,
        `Gap prompts: ${gapContext.join(" | ") || "Unknown"}`,
        `Niche guidance: ${brandNiches.join(", ") || "wellness"}`,
        `Candidates (use ONLY these fields; do not invent bios or URLs): ${JSON.stringify(candidates)}`,
        "Return JSON array only. For each candidate include handle, platform, display_name, recommended_follower_tier, niche_tags, match_reason, outreach_message, fit_score.",
        "match_reason: one distinct sentence (max ~260 chars) that cites this creator's topics or audience angle — never copy the same wording across two candidates.",
        "outreach_message: 3–5 sentence DM referencing a specific topic from niche_tags or topics; sound human; do not claim you watched their videos unless topics support it.",
        "If topics are thin or generic, say so and lower fit_score. fit_score 1–10.",
      ].join("\n"),
    );

    const parsed = parseJsonArray(response.text, scoredSchema);

    if (!parsed || parsed.length === 0) {
      return fallbackScoreCandidates({ brand, candidates, siteAnalysis });
    }

    return parsed.map((candidate) => {
      const matched = candidates.find(
        (item) =>
          item.handle === normalizeHandle(candidate.handle) &&
          item.platform === candidate.platform,
      );

      return {
        handle: normalizeHandle(candidate.handle),
        platform: candidate.platform,
        followerEstimate: matched?.followerEstimate ?? "",
        topics: matched?.topics ?? [],
        sourceUrls: matched?.sourceUrls ?? [],
        verificationStatus: matched?.verificationStatus ?? "low_confidence",
        verificationConfidence: matched?.verificationConfidence ?? 0,
        displayName: candidate.display_name ?? `@${candidate.handle}`,
        followerRange: normalizeFollowerRange(
          candidate.recommended_follower_tier,
          fallbackFollowerRange,
        ),
        nicheTags: candidate.niche_tags,
        matchReason: candidate.match_reason,
        outreachMessage: candidate.outreach_message,
        fitScore: candidate.fit_score,
      };
    });
  } catch (error) {
    logInfluencerError("score", error, { candidateCount: candidates.length });
    return fallbackScoreCandidates({ brand, candidates, siteAnalysis });
  }
}

async function saveInfluencerMatches({
  brand,
  cycle,
  matches,
}: {
  brand: BrandRecord;
  cycle: CycleRecord;
  matches: ScoredCandidate[];
}) {
  const supabase = createClient();
  const { data: existingRows } = await supabase
    .from("influencer_matches")
    .select("*")
    .eq("brand_id", brand.id)
    .returns<InfluencerMatchRecord[]>();

  const existing = existingRows ?? [];
  const cooldownCycleSet = new Set(
    Array.from({ length: INFLUENCER_COOLDOWN_CYCLES }, (_, index) => cycle.cycle_number - (index + 1)),
  );

  const isInCooldownWindow = (shownInCycle: number[]) =>
    shownInCycle.some((cycleNumber) => cooldownCycleSet.has(cycleNumber));

  const groundedMatches = matches
    .filter(
      (match) =>
        match.verificationStatus === "grounded" &&
        match.verificationConfidence >= MIN_VERIFICATION_CONFIDENCE,
    )
    .filter((match) => {
      const priorRow = existing.find(
        (row) => row.platform === match.platform && normalizeHandle(row.handle) === match.handle,
      );

      return !priorRow || !isInCooldownWindow(priorRow.shown_in_cycle);
    })
    .sort((left, right) => right.fitScore - left.fitScore)
    .slice(0, MAX_INFLUENCER_MATCHES_SAVED_PER_CYCLE);

  const lowConfidenceRescueMatches = matches
    .filter(
      (match) =>
        !groundedMatches.some(
          (grounded) => grounded.platform === match.platform && grounded.handle === match.handle,
        ),
    )
    .filter((match) => {
      const priorRow = existing.find(
        (row) => row.platform === match.platform && normalizeHandle(row.handle) === match.handle,
      );

      return !priorRow || !isInCooldownWindow(priorRow.shown_in_cycle);
    })
    .sort((left, right) => right.fitScore - left.fitScore)
    .slice(0, MAX_INFLUENCER_MATCHES_SAVED_PER_CYCLE)
    .map((match) => ({
      ...match,
      verificationStatus: "low_confidence" as const,
      verificationConfidence: Math.max(match.verificationConfidence, 55),
    }));

  const eligibleMatches = groundedMatches.length > 0 ? groundedMatches : lowConfidenceRescueMatches;

  const savedRows: InfluencerMatchRecord[] = [];

  for (const match of eligibleMatches) {
    const existingRow = existing.find(
      (row) => row.platform === match.platform && normalizeHandle(row.handle) === match.handle,
    );
    const payload = {
      brand_id: brand.id,
      cycle_id: cycle.id,
      platform: match.platform,
      handle: match.handle,
      display_name: match.displayName,
      follower_range: match.followerRange,
      niche_tags: match.nicheTags,
      match_reason: match.matchReason,
      outreach_message: match.outreachMessage,
      source_urls: match.sourceUrls,
      fit_score: match.fitScore,
      verification_status: match.verificationStatus,
      verification_confidence: match.verificationConfidence,
      shown_in_cycle: Array.from(new Set([...(existingRow?.shown_in_cycle ?? []), cycle.cycle_number])).sort(
        (left, right) => left - right,
      ),
    };

    const operation = existingRow
      ? supabase
          .from("influencer_matches")
          .update(payload)
          .eq("id", existingRow.id)
          .select("*")
          .single<InfluencerMatchRecord>()
      : supabase
          .from("influencer_matches")
          .insert(payload)
          .select("*")
          .single<InfluencerMatchRecord>();

    const { data, error } = await operation;

    if (error || !data) {
      logInfluencerError("store_match", error, { cycleId: cycle.id });
      continue;
    }

    savedRows.push(data);
  }

  return savedRows;
}

export async function generateCycleInfluencerMatches({
  brand,
  cycle,
  prompts,
  siteAnalysis,
}: {
  brand: BrandRecord;
  cycle: CycleRecord;
  prompts: PromptRecord[];
  siteAnalysis: SiteAnalysisRecord | null;
}): Promise<{ matches: InfluencerMatchRecord[]; refreshNote?: string }> {
  const tierConfig = getTierAnalysisConfig(brand.subscription_tier);
  const discoveryBackend = getInfluencerDiscoveryBackend();

  if (!tierConfig.influencerMatching) {
    return { matches: [] };
  }

  const providerContext: InfluencerProviderContext = {
    brand,
    cycle,
    prompts,
    siteAnalysis,
    minFollowerCount: MIN_INFLUENCER_FOLLOWERS,
  };

  const { candidates: discovered, discoveryHint } = await discoverInfluencersWithProviders(providerContext);
  console.info("[influencer-matcher]", {
    stage: "discovered",
    cycleId: cycle.id,
    discoveryBackend,
    candidateCount: discovered.length,
  });

  if (discovered.length === 0) {
    console.info("[influencer-matcher]", {
      stage: "empty_result",
      cycleId: cycle.id,
      reason: "no_discovered_candidates",
    });
    const refreshNote =
      discoveryHint ??
      "Discovery returned zero creators (Perplexity or legacy SocialFetch path produced no candidates, or JSON failed to parse). Check the server log for [perplexity], [influencer-discovery], or [socialfetch].";
    return { matches: [], refreshNote };
  }

  const scoredUnranked = await scoreCandidatesWithOpenAi({
    brand,
    candidates: discovered,
    prompts,
    siteAnalysis,
  });
  const scored = rankScoredMatches(scoredUnranked);

  console.info("[influencer-matcher]", {
    stage: "scored",
    cycleId: cycle.id,
    discoveryBackend,
    scoredCount: scored.length,
    top3Count: scored.slice(0, 3).length,
    groundedCount: scored.filter((item) => item.verificationStatus === "grounded").length,
  });

  const saved = await saveInfluencerMatches({ brand, cycle, matches: scored });

  console.info("[influencer-matcher]", {
    stage: "saved",
    cycleId: cycle.id,
    discoveryBackend,
    savedCount: saved.length,
    top3SavedCount: saved.slice().sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0)).slice(0, 3).length,
  });

  const refreshNote =
    saved.length === 0
      ? "Creators were discovered and scored, but none met the save rules (verification bar, cycle cooldown, or database write). Check server logs for [influencer-matcher] stage \"saved\"."
      : undefined;

  return { matches: saved, refreshNote };
}

export function getInfluencerProfileUrl(match: Pick<InfluencerMatchRecord, "platform" | "handle">) {
  return getProfileUrl(match.platform, normalizeHandle(match.handle));
}

export async function getInfluencerPageData(): Promise<InfluencerPageData | null> {
  const context = await getDashboardContext();

  if (!context?.brand) {
    return null;
  }

  const supabase = createClient();
  const { data: latestCompletedCycle } = await supabase
    .from("cycles")
    .select("*")
    .eq("brand_id", context.brand.id)
    .eq("status", "complete")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<CycleRecord>();

  const { data: matches } = latestCompletedCycle
    ? await supabase
        .from("influencer_matches")
        .select("*")
        .eq("brand_id", context.brand.id)
        .eq("cycle_id", latestCompletedCycle.id)
        .order("created_at", { ascending: true })
        .returns<InfluencerMatchRecord[]>()
    : { data: [] as InfluencerMatchRecord[] };

  const sortedMatches = [...(matches ?? [])].sort((left, right) => {
    const fitDelta = (right.fit_score ?? 0) - (left.fit_score ?? 0);
    if (fitDelta !== 0) {
      return fitDelta;
    }
    return (right.verification_confidence ?? 0) - (left.verification_confidence ?? 0);
  });

  return {
    brand: context.brand,
    latestCompletedCycle: latestCompletedCycle ?? null,
    matches: sortedMatches,
    topMatches: sortedMatches.slice(0, 3),
  };
}
