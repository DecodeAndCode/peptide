import "server-only";
import { z } from "zod";
import { queryPerplexity } from "@/lib/llm/perplexity";
import type { InfluencerProviderContext, ProviderCandidateHit } from "./types";
import type { InfluencerPlatform } from "@/types";

function coerceString(val: unknown): string {
  if (val === undefined || val === null) {
    return "";
  }
  return String(val).trim();
}

function coerceStringArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof val === "string" && val.trim()) {
    return [val.trim()];
  }
  return [];
}

export const influencerDiscoveryHitsSchema = z.array(
  z.object({
    handle: z
      .string()
      .transform((value) => value.trim().replace(/^@+/, ""))
      .pipe(z.string().min(1)),
    platform: z
      .string()
      .transform((value) => value.trim().toLowerCase())
      .pipe(z.enum(["instagram", "tiktok"])),
    follower_estimate: z.preprocess(coerceString, z.string()),
    post_count_estimate: z.preprocess(coerceString, z.string()).optional().default(""),
    last_active: z.preprocess(coerceString, z.string()).optional().default(""),
    engagement_signals: z.preprocess(coerceString, z.string()).optional().default(""),
    evidence_quotes: z.preprocess(coerceStringArray, z.array(z.string().min(1))).optional().default([]),
    external_citations: z.preprocess(coerceStringArray, z.array(z.string().min(1))).optional().default([]),
    topics: z.preprocess(coerceStringArray, z.array(z.string().min(1))),
    source_url: z.string().trim().optional().nullable(),
  }),
);

function stripMarkdownCodeFence(value: string) {
  return value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function parseJsonArray<T>(value: string, schema: z.ZodSchema<T>) {
  const trimmed = stripMarkdownCodeFence(value);
  try {
    const parsed = JSON.parse(trimmed);
    const normalized = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? [parsed]
        : [];
    const result = schema.safeParse(normalized);
    if (!result.success) {
      console.warn("[influencer-discovery]", {
        stage: "perplexity_json_schema_mismatch",
        issues: result.error.flatten(),
        preview: trimmed.slice(0, 500),
      });
    }
    return result.success ? result.data : null;
  } catch (error) {
    console.warn("[influencer-discovery]", {
      stage: "perplexity_json_parse_error",
      message: error instanceof Error ? error.message : "unknown",
      preview: trimmed.slice(0, 500),
    });
    return null;
  }
}

function dedupeStrings(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function getGapPrompts(prompts: InfluencerProviderContext["prompts"]) {
  return prompts
    .filter((prompt) => !prompt.brand_mentioned)
    .sort((left, right) => (right.competitors_mentioned?.length ?? 0) - (left.competitors_mentioned?.length ?? 0))
    .slice(0, 4)
    .map((prompt) => prompt.prompt_text);
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

function getBrandNicheTags(brand: InfluencerProviderContext["brand"]) {
  return Array.from(
    new Set(
      brand.industry_tags.flatMap((tag) => INDUSTRY_NICHE_GUIDANCE[tag] ?? [tag.replaceAll("_", " ").toLowerCase()]),
    ),
  ).slice(0, 8);
}

function getFallbackGapContext(context: InfluencerProviderContext) {
  const fromSite = dedupeStrings([
    ...(context.siteAnalysis?.missing_content_gaps ?? []),
    ...(context.siteAnalysis?.recommendations ?? []),
    ...(context.siteAnalysis?.content_signals?.topicKeywords ?? []),
    ...(context.siteAnalysis?.content_signals?.faqTopics ?? []),
  ]);

  if (fromSite.length > 0) {
    return fromSite.slice(0, 4);
  }

  const fromIndustry = dedupeStrings(
    context.brand.industry_tags.flatMap((tag) => INDUSTRY_NICHE_GUIDANCE[tag] ?? [tag.replaceAll("_", " ")]),
  );

  return fromIndustry.slice(0, 4);
}

function inferFollowerRange(context: InfluencerProviderContext) {
  const signalCount =
    (context.siteAnalysis?.content_signals?.productNames?.length ?? 0) +
    (context.siteAnalysis?.content_signals?.healthClaims?.length ?? 0) +
    (context.siteAnalysis?.content_signals?.faqTopics?.length ?? 0);

  if (signalCount >= 18) return "macro_200k+";
  if (signalCount >= 10) return "mid_50k_200k";
  return "micro_10k_50k";
}

export function buildDiscoveryQueries(context: InfluencerProviderContext) {
  const niches = getBrandNicheTags(context.brand);
  const followerRange = inferFollowerRange(context);
  const gapPrompts = getGapPrompts(context.prompts);
  const fallbackGapContext = getFallbackGapContext(context);
  const gapContext = gapPrompts.length > 0 ? gapPrompts : fallbackGapContext;
  const platforms: InfluencerPlatform[] = ["instagram", "tiktok"];

  return platforms.map((platform, index) => {
    const niche = niches[index % Math.max(1, niches.length)] ?? "wellness";
    const gapPrompt = gapContext[index % Math.max(1, gapContext.length)] ?? "supplement education";

    return `Search for real, established, ACTIVELY POSTING ${platform} creators in the ${niche} space relevant to ${
      context.brand.brand_name
    }. Required: ${followerRange} accounts with AT LEAST ${context.minFollowerCount.toLocaleString()} followers (verified from external sources, NOT inferred), at least 30 public posts, and content posted within the last 6 months. Skip dormant accounts, private accounts, parody accounts, and accounts with only a handful of posts. Use this cycle context to guide relevance: "${gapPrompt}". Vary results for cycle #${
      context.cycle.cycle_number
    } so the same creators are not repeated every run.`;
  });
}

export async function discoverWithPerplexity(context: InfluencerProviderContext): Promise<ProviderCandidateHit[]> {
  const discoveryQueries = buildDiscoveryQueries(context);
  const candidates: ProviderCandidateHit[] = [];

  for (const query of discoveryQueries) {
    try {
      const response = await queryPerplexity(
        [
          query,
          "Find 3–5 creators who openly and regularly post as fitness or wellness creators on this platform (not random personal accounts, not dormant accounts).",
          "DO NOT include any creator unless you can ground these claims from your search results:",
          `  - follower_estimate: PUBLIC follower count from a search snippet (digits plus optional k/M, e.g. 12500, 12.5k, 1.2M). Must be at least ${context.minFollowerCount.toLocaleString()}. If unconfirmed, OMIT the row.`,
          "  - post_count_estimate: approximate number of public posts (e.g. \"200+\", \"480\", \"1.2k\"). Must be at least 30. If unknown, OMIT the row.",
          "  - last_active: how recently they posted (e.g. \"posted within last week\", \"last post 2 months ago\"). Must be within the last 6 months. If unknown or stale, OMIT the row.",
          "  - engagement_signals: 1 short phrase about engagement quality (e.g. \"500+ likes, active comments\", \"viral hybrid training videos\"). Be specific.",
          "  - evidence_quotes: array of 1–3 VERBATIM short snippets from your search results that mention the follower count, activity, or engagement. These prove your numbers are real, not invented.",
          "  - external_citations: array of 1–3 URLs that are NOT the creator's own profile URL (e.g. news articles, podcast appearances, listicles, social-stats aggregators, brand collaborations). Use these to cross-verify.",
          `  - source_url: the creator's canonical profile link, matching the handle exactly: https://www.instagram.com/{handle}/ for instagram, https://www.tiktok.com/@{handle} for tiktok (lowercase handle, no spaces).`,
          "At least one of: source_url OR the search citations must visibly contain that same canonical profile URL so the handle and URL cannot disagree.",
          'Return JSON array only: [{"handle":"","platform":"instagram|tiktok","follower_estimate":"","post_count_estimate":"","last_active":"","engagement_signals":"","evidence_quotes":[""],"external_citations":["https://..."],"topics":[""],"source_url":"https://..."}].',
          "Use lowercase platform values exactly: \"instagram\" or \"tiktok\". topics: 2–5 short phrases about what they post (e.g. strength training, hybrid athletics, supplement reviews).",
          "Hard rules: NO invented handles, NO parody/fan accounts, NO celebrities unless clearly the right account, NO duplicate handles. If you cannot verify ALL required fields from search results, OMIT that creator entirely. Better to return fewer rows than fabricated ones. No markdown fences or commentary.",
        ].join("\n"),
        { maxTokens: 3_072 },
      );

      const parsed = parseJsonArray(response.text, influencerDiscoveryHitsSchema);
      if (!parsed) {
        console.info("[influencer-discovery]", {
          stage: "perplexity_parse_empty",
          textLength: response.text.trim().length,
          textPreview: response.text.trim().slice(0, 240),
        });
        continue;
      }

      for (const item of parsed) {
        candidates.push({
          handle: item.handle,
          platform: item.platform,
          followerEstimate: item.follower_estimate,
          postCountEstimate: item.post_count_estimate,
          lastActive: item.last_active,
          engagementSignals: item.engagement_signals,
          evidenceQuotes: item.evidence_quotes,
          externalCitations: item.external_citations,
          topics: item.topics,
          sourceUrl: item.source_url ?? null,
          citationUrls: response.citationUrls,
        });
      }
    } catch (error) {
      console.warn("[influencer-discovery]", {
        stage: "perplexity_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return candidates;
}

