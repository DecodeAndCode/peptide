import "server-only";
import { z } from "zod";
import { getDashboardContext } from "@/lib/brands";
import { queryOpenAi } from "@/lib/llm/openai";
import { queryPerplexity } from "@/lib/llm/perplexity";
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

const discoverySchema = z.array(
  z.object({
    handle: z.string().trim().min(1),
    platform: z.enum(["instagram", "tiktok"]),
    follower_estimate: z.string().trim().min(1).optional().default(""),
    topics: z.array(z.string().trim().min(1)).optional().default([]),
    source_url: z.string().url().optional().nullable(),
  }),
);

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

interface DiscoveryCandidate {
  handle: string;
  platform: InfluencerPlatform;
  followerEstimate: string;
  topics: string[];
  sourceUrl: string | null;
}

interface ScoredCandidate extends DiscoveryCandidate {
  displayName: string | null;
  followerRange: InfluencerFollowerRange;
  nicheTags: string[];
  matchReason: string;
  outreachMessage: string;
  fitScore: number;
}

export interface InfluencerPageData {
  brand: BrandRecord;
  latestCompletedCycle: CycleRecord | null;
  matches: InfluencerMatchRecord[];
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

function buildDiscoveryQueries({
  brand,
  prompts,
  siteAnalysis,
  cycle,
}: {
  brand: BrandRecord;
  prompts: PromptRecord[];
  siteAnalysis: SiteAnalysisRecord | null;
  cycle: CycleRecord;
}) {
  const niches = getBrandNicheTags(brand);
  const followerRange = inferFollowerRange(siteAnalysis);
  const gapPrompts = getGapPrompts(prompts);
  const platforms: InfluencerPlatform[] = ["instagram", "tiktok"];

  return platforms.map((platform, index) => {
    const niche = niches[index % Math.max(1, niches.length)] ?? "wellness";
    const gapPrompt = gapPrompts[index % Math.max(1, gapPrompts.length)] ?? "supplement education";

    return `Search for real, active ${platform} creators in the ${niche} space relevant to ${
      brand.brand_name
    }. Focus on ${followerRange} accounts and use this cycle context to guide relevance: "${gapPrompt}". Vary results for cycle #${
      cycle.cycle_number
    } so the same creators are not repeated every run.`;
  });
}

async function discoverInfluencers({
  brand,
  prompts,
  siteAnalysis,
  cycle,
}: {
  brand: BrandRecord;
  prompts: PromptRecord[];
  siteAnalysis: SiteAnalysisRecord | null;
  cycle: CycleRecord;
}) {
  const discoveryQueries = buildDiscoveryQueries({ brand, prompts, siteAnalysis, cycle });
  const candidates: DiscoveryCandidate[] = [];

  for (const query of discoveryQueries) {
    try {
      const response = await queryPerplexity(
        [
          query,
          "For each creator you find, return their handle, platform, approximate follower count, and the primary health or wellness topics they cover.",
          "Return ONLY creators you can verify exist based on live public web results.",
          'Return JSON array only: [{"handle":"","platform":"instagram|tiktok","follower_estimate":"","topics":[""],"source_url":"https://..."}].',
          "No preamble. No invented accounts.",
        ].join("\n"),
      );

      const parsed = parseJsonArray(response.text, discoverySchema);

      if (!parsed) {
        continue;
      }

      candidates.push(
        ...parsed.map((item) => ({
          handle: normalizeHandle(item.handle),
          platform: item.platform,
          followerEstimate: item.follower_estimate,
          topics: item.topics,
          sourceUrl: item.source_url ?? null,
        })),
      );
    } catch (error) {
      logInfluencerError("discover", error, { cycleId: cycle.id });
    }
  }

  return dedupe(
    candidates.filter((candidate) => Boolean(candidate.handle)),
    (candidate) => `${candidate.platform}:${candidate.handle}`,
  );
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
          ? `This creator already covers themes adjacent to ${brand.brand_name}'s category positioning, making the fit stronger than a generic wellness placement.`
          : `This creator is active in adjacent wellness conversations and could help broaden ${brand.brand_name}'s reach with a category-relevant introduction.`,
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
  const fallbackFollowerRange = inferFollowerRange(siteAnalysis);

  try {
    const response = await queryOpenAi(
      [
        "Score the following real influencer candidates for brand fit.",
        `Brand: ${brand.brand_name}`,
        `Industry tags: ${brand.industry_tags.map(getIndustryLabel).join(", ") || "Unknown"}`,
        `Hero products: ${siteAnalysis?.content_signals?.productNames?.slice(0, 6).join(", ") || "Unknown"}`,
        `Gap prompts: ${gapPrompts.join(" | ") || "Unknown"}`,
        `Niche guidance: ${brandNiches.join(", ") || "wellness"}`,
        `Candidates: ${JSON.stringify(candidates)}`,
        "Return JSON array only. For each candidate include handle, platform, display_name, recommended_follower_tier, niche_tags, match_reason, outreach_message, and fit_score.",
        "The outreach message should be a natural 3-5 sentence DM, not spammy, and should reference a topic the creator already covers.",
      ].join("\n"),
    );

    const parsed = parseJsonArray(response.text, scoredSchema);

    if (!parsed) {
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
        sourceUrl: matched?.sourceUrl ?? null,
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

  const previousCycleNumber = cycle.cycle_number - 1;
  const existing = existingRows ?? [];

  const eligibleMatches = matches
    .filter((match) => {
      const priorRow = existing.find(
        (row) => row.platform === match.platform && normalizeHandle(row.handle) === match.handle,
      );

      return !priorRow?.shown_in_cycle.includes(previousCycleNumber);
    })
    .sort((left, right) => right.fitScore - left.fitScore)
    .slice(0, 8);

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
}) {
  const tierConfig = getTierAnalysisConfig(brand.subscription_tier);

  if (!tierConfig.influencerMatching) {
    return [];
  }

  const discovered = await discoverInfluencers({ brand, prompts, siteAnalysis, cycle });

  if (discovered.length === 0) {
    return [];
  }

  const scored = await scoreCandidatesWithOpenAi({
    brand,
    candidates: discovered,
    prompts,
    siteAnalysis,
  });

  return saveInfluencerMatches({ brand, cycle, matches: scored });
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

  return {
    brand: context.brand,
    latestCompletedCycle: latestCompletedCycle ?? null,
    matches: matches ?? [],
  };
}
