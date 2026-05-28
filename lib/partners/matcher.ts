import "server-only";
import { z } from "zod";
import { getDashboardContext } from "@/lib/brands";
import { queryOpenAi } from "@/lib/llm/openai";
import { queryPerplexity } from "@/lib/llm/perplexity";
import { isSuppgoTestModeEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getTierAnalysisConfig, getIndustryLabel } from "@/lib/suppgo";
import type {
  BrandRecord,
  CycleRecord,
  PartnerCategory,
  PartnerMatchRecord,
  PromptRecord,
  SiteAnalysisRecord,
} from "@/types";

const scoredSchema = z.array(
  z.object({
    name: z.string().trim().min(1),
    partner_type: z.enum(["gym", "apparel", "retailer", "other"]),
    website_url: z.string().trim().url().optional().nullable(),
    region: z.string().trim().min(1).optional().nullable(),
    match_reason: z.string().trim().min(10).max(320),
    outreach_message: z.string().trim().min(20).max(1200),
    fit_score: z.number().min(1).max(10).optional().default(5),
  }),
);

interface DiscoveryCandidate {
  name: string;
  partnerType: PartnerCategory;
  websiteUrl: string | null;
  region: string | null;
  topics: string[];
  sourceUrls: string[];
}

interface ScoredCandidate extends DiscoveryCandidate {
  matchReason: string;
  outreachMessage: string;
  fitScore: number;
}

const PARTNER_COOLDOWN_CYCLES = 3;
const MAX_PARTNER_MATCHES_SAVED_PER_CYCLE = 3;

export interface PartnerPageData {
  brand: BrandRecord;
  latestCompletedCycle: CycleRecord | null;
  matches: PartnerMatchRecord[];
  topMatches: PartnerMatchRecord[];
}

const INDUSTRY_PARTNER_GUIDANCE: Record<string, { types: PartnerCategory[]; keywords: string[] }> = {
  nootropics_cognitive: {
    types: ["gym", "apparel", "retailer"],
    keywords: ["biohacking", "productivity", "performance", "optimization"],
  },
  greens_superfoods: {
    types: ["gym", "retailer", "apparel"],
    keywords: ["clean eating", "wellness", "organic", "health food"],
  },
  adaptogens: {
    types: ["retailer", "gym", "apparel"],
    keywords: ["holistic wellness", "stress relief", "natural health"],
  },
  peptides_topical_cosmetic: {
    types: ["retailer", "gym", "apparel"],
    keywords: ["anti-aging", "skincare", "aesthetics", "beauty"],
  },
  protein_performance: {
    types: ["gym", "apparel", "retailer"],
    keywords: ["fitness", "strength training", "bodybuilding", "athletic performance"],
  },
  sleep_recovery: {
    types: ["gym", "retailer", "apparel"],
    keywords: ["recovery", "wellness", "sleep optimization", "relaxation"],
  },
  vitamins_minerals: {
    types: ["retailer", "gym", "apparel"],
    keywords: ["wellness", "nutrition", "health", "supplements"],
  },
  weight_management: {
    types: ["gym", "apparel", "retailer"],
    keywords: ["fitness", "weight loss", "metabolism", "wellness"],
  },
  gut_health: {
    types: ["retailer", "gym", "apparel"],
    keywords: ["digestive health", "wellness", "nutrition", "clean eating"],
  },
  womens_health: {
    types: ["gym", "retailer", "apparel"],
    keywords: ["women's wellness", "fitness", "hormone health"],
  },
  mens_health: {
    types: ["gym", "apparel", "retailer"],
    keywords: ["men's fitness", "performance", "optimization", "strength"],
  },
  general_wellness: {
    types: ["gym", "retailer", "apparel"],
    keywords: ["wellness", "fitness", "health", "lifestyle"],
  },
};

function logPartnerError(
  stage: string,
  error: unknown,
  meta: Record<string, string | number | boolean | null | undefined> = {},
) {
  console.error("[partner-matcher]", {
    stage,
    message: error instanceof Error ? error.message : "Unknown error",
    ...meta,
  });
}

function stripMarkdownCodeFence(value: string) {
  return value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function dedupeStrings(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
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

function extractRegionFromContentSignals(siteAnalysis: SiteAnalysisRecord | null): string {
  const signals = siteAnalysis?.content_signals;
  if (!signals) {
    return "United States";
  }

  const hqRegion = (signals as any).hq_region;
  const targetMarkets = (signals as any).target_markets;

  if (typeof hqRegion === "string" && hqRegion.trim()) {
    return hqRegion.trim();
  }

  if (Array.isArray(targetMarkets) && targetMarkets.length > 0) {
    const firstMarket = String(targetMarkets[0]).trim();
    if (firstMarket) {
      return firstMarket;
    }
  }

  return "United States";
}

function getPartnerTypesForBrand(brand: BrandRecord): PartnerCategory[] {
  const allTypes = brand.industry_tags.flatMap(
    (tag) => INDUSTRY_PARTNER_GUIDANCE[tag]?.types ?? (["gym", "apparel", "retailer"] as PartnerCategory[]),
  );

  return Array.from(new Set(allTypes)).slice(0, 3);
}

function getPartnerKeywords(brand: BrandRecord): string[] {
  return Array.from(
    new Set(
      brand.industry_tags.flatMap(
        (tag) => INDUSTRY_PARTNER_GUIDANCE[tag]?.keywords ?? [getIndustryLabel(tag).toLowerCase()],
      ),
    ),
  ).slice(0, 6);
}

async function discoverPartnersWithPerplexity({
  brand,
  siteAnalysis,
  cycle,
}: {
  brand: BrandRecord;
  siteAnalysis: SiteAnalysisRecord | null;
  cycle: CycleRecord;
}): Promise<DiscoveryCandidate[]> {
  const region = extractRegionFromContentSignals(siteAnalysis);
  const partnerTypes = getPartnerTypesForBrand(brand);
  const keywords = getPartnerKeywords(brand);
  const candidates: DiscoveryCandidate[] = [];

  const testMode = isSuppgoTestModeEnabled();
  const partnerTypesToQuery = testMode ? partnerTypes.slice(0, 1) : partnerTypes;

  for (const partnerType of partnerTypesToQuery) {
    const partnerLabel =
      partnerType === "gym"
        ? "gyms or fitness studios"
        : partnerType === "apparel"
          ? "fitness apparel brands or activewear companies"
          : partnerType === "retailer"
            ? "health food stores or supplement retailers"
            : "wellness businesses";

    try {
      const response = await queryPerplexity(
        [
          `Find 3-5 real ${partnerLabel} in ${region} that align with ${keywords.slice(0, 3).join(", ")} for potential partnerships with ${brand.brand_name}.`,
          "Focus on businesses that have a strong local or regional presence, active online presence, and align with wellness/fitness audiences.",
          `For cycle #${cycle.cycle_number}, vary the results so the same partners are not repeated every run.`,
          `Return JSON array only: [{"name":"Business Name","partner_type":"${partnerType}","website_url":"https://...","region":"City, State or Region","topics":["keyword1","keyword2"]}].`,
          "Each entry must have a real business name, valid website URL if available, and specific location. Topics should be short keywords.",
          "No markdown fences or commentary. Return only the JSON array.",
        ].join("\n"),
        { maxTokens: 2_048 },
      );

      const parsed = parseJsonArray(
        response.text,
        z.array(
          z.object({
            name: z.string().trim().min(1),
            partner_type: z.string().trim().toLowerCase(),
            website_url: z.string().trim().optional().nullable(),
            region: z.string().trim().optional().nullable(),
            topics: z.array(z.string().trim().min(1)).optional().default([]),
          }),
        ),
      );

      if (!parsed) {
        console.info("[partner-matcher]", {
          stage: "perplexity_parse_empty",
          partnerType,
        });
        continue;
      }

      for (const item of parsed) {
        const normalizedType = (["gym", "apparel", "retailer"].includes(item.partner_type)
          ? item.partner_type
          : "other") as PartnerCategory;

        candidates.push({
          name: item.name,
          partnerType: normalizedType,
          websiteUrl: item.website_url?.trim() || null,
          region: item.region?.trim() || region,
          topics: item.topics.slice(0, 5),
          sourceUrls: response.citationUrls,
        });
      }
    } catch (error) {
      logPartnerError("perplexity_query_failed", error, { partnerType });
    }
  }

  return dedupe(candidates, (c) => c.name.toLowerCase().trim());
}

function buildFallbackOutreachMessage({
  brand,
  candidate,
}: {
  brand: BrandRecord;
  candidate: DiscoveryCandidate;
}) {
  const topic = candidate.topics[0] ?? "wellness";
  return [
    `Hi, I lead partnerships for ${brand.brand_name}.`,
    `I came across your business and think there's strong alignment around ${topic} and the audiences we both serve.`,
    "If you're open to exploring a partnership, I'd love to share how we could collaborate in a way that adds value to your customers.",
    "Happy to send details if it feels relevant.",
  ].join(" ");
}

function fallbackScoreCandidates({
  brand,
  candidates,
}: {
  brand: BrandRecord;
  candidates: DiscoveryCandidate[];
}) {
  const brandKeywords = getPartnerKeywords(brand);

  return candidates.map((candidate) => {
    const lowerTopics = candidate.topics.map((topic) => topic.toLowerCase());
    const overlapCount = brandKeywords.filter((keyword) =>
      lowerTopics.some(
        (topic) => topic.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(topic),
      ),
    ).length;
    const fitScore = Math.max(4, Math.min(10, 5 + overlapCount));

    return {
      ...candidate,
      matchReason:
        overlapCount > 0
          ? `${candidate.name} overlaps with ${brand.brand_name}'s space on ${candidate.topics.slice(0, 2).join(" & ") || "relevant themes"}.`
          : `${candidate.name} reaches adjacent wellness/fitness audiences where ${brand.brand_name} could add value.`,
      outreachMessage: buildFallbackOutreachMessage({ brand, candidate }),
      fitScore,
    };
  });
}

async function scoreCandidatesWithOpenAi({
  brand,
  candidates,
  siteAnalysis,
}: {
  brand: BrandRecord;
  candidates: DiscoveryCandidate[];
  siteAnalysis: SiteAnalysisRecord | null;
}) {
  const brandKeywords = getPartnerKeywords(brand);

  try {
    const response = await queryOpenAi(
      [
        "You are validating partner matches for brand partnerships. Each input candidate was surfaced from web search.",
        `Brand: ${brand.brand_name}`,
        `Industry tags: ${brand.industry_tags.map(getIndustryLabel).join(", ") || "Unknown"}`,
        `Hero products: ${siteAnalysis?.content_signals?.productNames?.slice(0, 6).join(", ") || "Unknown"}`,
        `Partner guidance: ${brandKeywords.join(", ") || "wellness"}`,
        `Candidates: ${JSON.stringify(candidates)}`,
        "Return JSON array only. For each candidate include name, partner_type, website_url, region, match_reason, outreach_message, fit_score.",
        "match_reason: one distinct sentence (max ~260 chars) that cites this partner's relevance — never copy the same wording across two candidates.",
        "outreach_message: 3–5 sentence email/DM referencing a specific alignment point; sound human and professional.",
        "If topics are thin or generic, say so and lower fit_score. fit_score 1–10.",
      ].join("\n"),
    );

    const parsed = parseJsonArray(response.text, scoredSchema);

    if (!parsed || parsed.length === 0) {
      return fallbackScoreCandidates({ brand, candidates });
    }

    return parsed.map((candidate) => {
      const matched = candidates.find((item) => item.name.toLowerCase() === candidate.name.toLowerCase());

      return {
        name: candidate.name,
        partnerType: candidate.partner_type,
        websiteUrl: candidate.website_url?.trim() || matched?.websiteUrl || null,
        region: candidate.region?.trim() || matched?.region || null,
        topics: matched?.topics ?? [],
        sourceUrls: matched?.sourceUrls ?? [],
        matchReason: candidate.match_reason,
        outreachMessage: candidate.outreach_message,
        fitScore: candidate.fit_score,
      };
    });
  } catch (error) {
    logPartnerError("score", error, { candidateCount: candidates.length });
    return fallbackScoreCandidates({ brand, candidates });
  }
}

function rankScoredMatches(matches: ScoredCandidate[]) {
  return [...matches].sort((left, right) => {
    if (right.fitScore !== left.fitScore) {
      return right.fitScore - left.fitScore;
    }

    return left.name.localeCompare(right.name);
  });
}

async function savePartnerMatches({
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
    .from("partner_matches")
    .select("*")
    .eq("brand_id", brand.id)
    .returns<PartnerMatchRecord[]>();

  const existing = existingRows ?? [];
  const cooldownCycleSet = new Set(
    Array.from({ length: PARTNER_COOLDOWN_CYCLES }, (_, index) => cycle.cycle_number - (index + 1)),
  );

  const isInCooldownWindow = (shownInCycle: number[]) =>
    shownInCycle.some((cycleNumber) => cooldownCycleSet.has(cycleNumber));

  const eligibleMatches = matches
    .filter((match) => {
      const priorRow = existing.find((row) => row.name.toLowerCase() === match.name.toLowerCase());

      return !priorRow || !isInCooldownWindow(priorRow.shown_in_cycle);
    })
    .sort((left, right) => right.fitScore - left.fitScore)
    .slice(0, MAX_PARTNER_MATCHES_SAVED_PER_CYCLE);

  const savedRows: PartnerMatchRecord[] = [];

  for (const match of eligibleMatches) {
    const existingRow = existing.find((row) => row.name.toLowerCase() === match.name.toLowerCase());
    const payload = {
      brand_id: brand.id,
      cycle_id: cycle.id,
      partner_type: match.partnerType,
      name: match.name,
      website_url: match.websiteUrl,
      region: match.region,
      match_reason: match.matchReason,
      outreach_message: match.outreachMessage,
      source_urls: match.sourceUrls,
      fit_score: match.fitScore,
      shown_in_cycle: Array.from(new Set([...(existingRow?.shown_in_cycle ?? []), cycle.cycle_number])).sort(
        (left, right) => left - right,
      ),
    };

    const operation = existingRow
      ? supabase
          .from("partner_matches")
          .update(payload)
          .eq("id", existingRow.id)
          .select("*")
          .single<PartnerMatchRecord>()
      : supabase
          .from("partner_matches")
          .insert(payload)
          .select("*")
          .single<PartnerMatchRecord>();

    const { data, error } = await operation;

    if (error || !data) {
      logPartnerError("store_match", error, { cycleId: cycle.id });
      continue;
    }

    savedRows.push(data);
  }

  return savedRows;
}

export async function generateCyclePartnerMatches({
  brand,
  cycle,
  prompts,
  siteAnalysis,
}: {
  brand: BrandRecord;
  cycle: CycleRecord;
  prompts: PromptRecord[];
  siteAnalysis: SiteAnalysisRecord | null;
}): Promise<{ matches: PartnerMatchRecord[]; refreshNote?: string }> {
  const tierConfig = getTierAnalysisConfig(brand.subscription_tier);

  if (!tierConfig.influencerMatching) {
    return { matches: [] };
  }

  const discovered = await discoverPartnersWithPerplexity({
    brand,
    siteAnalysis,
    cycle,
  });

  console.info("[partner-matcher]", {
    stage: "discovered",
    cycleId: cycle.id,
    candidateCount: discovered.length,
  });

  if (discovered.length === 0) {
    const refreshNote = "Discovery returned zero partners. Check the server log for [partner-matcher].";
    return { matches: [], refreshNote };
  }

  const scoredUnranked = await scoreCandidatesWithOpenAi({
    brand,
    candidates: discovered,
    siteAnalysis,
  });
  const scored = rankScoredMatches(scoredUnranked);

  console.info("[partner-matcher]", {
    stage: "scored",
    cycleId: cycle.id,
    scoredCount: scored.length,
  });

  const saved = await savePartnerMatches({ brand, cycle, matches: scored });

  console.info("[partner-matcher]", {
    stage: "saved",
    cycleId: cycle.id,
    savedCount: saved.length,
  });

  const refreshNote =
    saved.length === 0
      ? "Partners were discovered and scored, but none met the save rules (cycle cooldown or database write). Check server logs for [partner-matcher] stage \"saved\"."
      : undefined;

  return { matches: saved, refreshNote };
}

export async function getPartnerPageData(): Promise<PartnerPageData | null> {
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
        .from("partner_matches")
        .select("*")
        .eq("brand_id", context.brand.id)
        .eq("cycle_id", latestCompletedCycle.id)
        .order("created_at", { ascending: true })
        .returns<PartnerMatchRecord[]>()
    : { data: [] as PartnerMatchRecord[] };

  const sortedMatches = [...(matches ?? [])].sort((left, right) => {
    const fitDelta = (right.fit_score ?? 0) - (left.fit_score ?? 0);
    if (fitDelta !== 0) {
      return fitDelta;
    }
    return left.name.localeCompare(right.name);
  });

  return {
    brand: context.brand,
    latestCompletedCycle: latestCompletedCycle ?? null,
    matches: sortedMatches,
    topMatches: sortedMatches.slice(0, 3),
  };
}
