import "server-only";
import { z } from "zod";
import { queryPerplexity } from "@/lib/llm/perplexity";
import type { InfluencerProviderContext, ProviderCandidateHit } from "./types";
import type { InfluencerPlatform } from "@/types";

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
    follower_estimate: z.preprocess((val) => {
      if (val === undefined || val === null) {
        return "";
      }
      return String(val).trim();
    }, z.string()),
    topics: z.preprocess((val) => {
      if (Array.isArray(val)) {
        return val.map((item) => String(item).trim()).filter(Boolean);
      }
      if (typeof val === "string" && val.trim()) {
        return [val.trim()];
      }
      return [];
    }, z.array(z.string().min(1))),
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

    return `Search for real, active ${platform} creators in the ${niche} space relevant to ${
      context.brand.brand_name
    }. Focus on ${followerRange} accounts with at least ${context.minFollowerCount.toLocaleString()} followers, recent public posting history, and public profiles. Use this cycle context to guide relevance: "${gapPrompt}". Vary results for cycle #${
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
          "Find 3–5 creators who openly post as fitness or wellness creators on this platform (not random personal accounts).",
          `Every row must be honest: include follower_estimate as an approximate PUBLIC count from your search snippets, and it must be at least ${context.minFollowerCount.toLocaleString()} (use digits plus optional k/M, e.g. 12500, 12.5k, 1.2M). If you cannot confirm that floor, omit the row entirely.`,
          `source_url MUST be the creator's canonical profile link and MUST match the handle: for instagram use https://www.instagram.com/{handle}/ ; for tiktok use https://www.tiktok.com/@{handle} (lowercase handle, no spaces).`,
          "At least one of: source_url OR the search citations you rely on must visibly contain that same canonical profile URL so the handle and URL cannot disagree.",
          'Return JSON array only: [{"handle":"","platform":"instagram|tiktok","follower_estimate":"","topics":[""],"source_url":"https://..."}].',
          "Use lowercase platform values exactly: \"instagram\" or \"tiktok\". topics: short phrases about what they post (e.g. strength training, supplement reviews).",
          "Rules: no invented handles, no celebrities unless clearly the right account, no duplicate handles. No markdown fences or commentary.",
        ].join("\n"),
        { maxTokens: 2_048 },
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

