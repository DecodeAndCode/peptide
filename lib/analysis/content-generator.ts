import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  canonicalizeIngredientList,
  canonicalizeIngredientMentions,
} from "@/lib/analysis/ingredient-normalization";
import { queryOpenAi } from "@/lib/llm/openai";
import { queryPerplexity } from "@/lib/llm/perplexity";
import { getIndustryLabel, getTierAnalysisConfig } from "@/lib/suppgo";
import { createClient } from "@/lib/supabase/server";
import type {
  BrandRecord,
  CycleRecord,
  GeneratedContentRecord,
  PromptCategory,
  PromptRecord,
  SiteAnalysisRecord,
} from "@/types";

const structuredContentSchema = z.object({
  title: z.string().min(3).max(180),
  body: z.string().min(80),
  cited_sources: z.array(z.string().url()).max(8).optional().default([]),
  target_query: z.string().min(3),
});

const AUTHORITY_SOURCE_PATTERNS = [
  /nih\.gov/i,
  /pubmed\.ncbi\.nlm\.nih\.gov/i,
  /mayoclinic\.org/i,
  /clevelandclinic\.org/i,
  /webmd\.com/i,
  /healthline\.com/i,
  /examine\.com/i,
  /\.gov\//i,
  /\.edu\//i,
];

interface GeneratedContentInsert {
  content_type: GeneratedContentRecord["content_type"];
  title: string;
  body: string;
  target_prompts: string[];
  medical_sources: string[];
}

interface PromptOpportunity {
  promptText: string;
  category: PromptCategory;
  missCount: number;
  competitorCount: number;
}

const PROMPT_REUSE_COOLDOWN_CYCLES = 2;

interface RecentPromptUsage {
  blockedPromptKeys: Set<string>;
  lastUsedCycleByPromptKey: Map<string, number>;
}

function logContentGenerationError(
  stage: string,
  error: unknown,
  meta: Record<string, string | number | boolean | null | undefined> = {},
) {
  console.error("[content-generator]", {
    stage,
    message: error instanceof Error ? error.message : "Unknown error",
    ...meta,
  });
}

function stripMarkdownCodeFence(value: string) {
  return value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function safeParseStructuredContent(rawText: string) {
  try {
    const parsed = JSON.parse(stripMarkdownCodeFence(rawText));
    return structuredContentSchema.safeParse(parsed);
  } catch {
    return { success: false as const };
  }
}

function buildSiteContext(siteAnalysis: SiteAnalysisRecord | null) {
  const signals = siteAnalysis?.content_signals;
  return {
    products: signals?.productNames?.slice(0, 8) ?? [],
    ingredients: canonicalizeIngredientList(signals?.ingredients ?? [], 10),
    claims: signals?.healthClaims?.slice(0, 6) ?? [],
    faqTopics: signals?.faqTopics?.slice(0, 8) ?? [],
  };
}

function filterAuthoritySources(urls: string[]) {
  return Array.from(
    new Set(urls.filter((url) => AUTHORITY_SOURCE_PATTERNS.some((pattern) => pattern.test(url)))),
  ).slice(0, 6);
}

function getPromptOpportunities(prompts: PromptRecord[], category?: PromptCategory) {
  const grouped = new Map<string, PromptOpportunity>();

  prompts.forEach((prompt) => {
    if (category && prompt.prompt_category !== category) {
      return;
    }

    if (prompt.brand_mentioned) {
      return;
    }

    const canonicalPromptText =
      prompt.prompt_category === "product_interaction"
        ? canonicalizeIngredientMentions(prompt.prompt_text)
        : prompt.prompt_text;

    const existing = grouped.get(canonicalPromptText) ?? {
      promptText: canonicalPromptText,
      category: prompt.prompt_category,
      missCount: 0,
      competitorCount: 0,
    };

    existing.missCount += 1;
    existing.competitorCount += prompt.competitors_mentioned?.length ?? 0;
    grouped.set(canonicalPromptText, existing);
  });

  return Array.from(grouped.values()).sort((left, right) => {
    if (right.competitorCount !== left.competitorCount) {
      return right.competitorCount - left.competitorCount;
    }

    return right.missCount - left.missCount;
  });
}

function normalizePromptKey(value: string) {
  return canonicalizeIngredientMentions(value).trim().toLowerCase();
}

function buildNovelPromptVariant(promptText: string, category: PromptCategory) {
  const trimmed = promptText.trim().replace(/\?$/, "");

  if (category === "product_interaction") {
    return `${trimmed} for first-time stack users?`;
  }

  if (category === "problem_solution") {
    return `${trimmed} right now?`;
  }

  if (category === "explicit_recommendation") {
    return `${trimmed} for beginners?`;
  }

  return `${trimmed} in simple terms?`;
}

function applyRecentPromptCooldown({
  opportunities,
  usage,
}: {
  opportunities: PromptOpportunity[];
  usage: RecentPromptUsage;
}) {
  const filtered =
    usage.blockedPromptKeys.size > 0
      ? opportunities.filter((opportunity) => !usage.blockedPromptKeys.has(normalizePromptKey(opportunity.promptText)))
      : opportunities;

  const candidatePool = filtered.length > 0 ? filtered : opportunities;
  const ranked = [...candidatePool].sort((left, right) => {
    const leftKey = normalizePromptKey(left.promptText);
    const rightKey = normalizePromptKey(right.promptText);
    const leftLastUsed = usage.lastUsedCycleByPromptKey.get(leftKey) ?? 0;
    const rightLastUsed = usage.lastUsedCycleByPromptKey.get(rightKey) ?? 0;

    if (leftLastUsed !== rightLastUsed) {
      return leftLastUsed - rightLastUsed; // older (or never used) first
    }

    if (right.competitorCount !== left.competitorCount) {
      return right.competitorCount - left.competitorCount;
    }

    return right.missCount - left.missCount;
  });

  if (filtered.length === 0 && ranked.length > 0) {
    // Guarantee at least one fresh suggestion even when all historical prompts are on cooldown.
    // This prevents cycles from becoming visually repetitive for users.
    const seed = ranked[0];
    const candidateVariant = buildNovelPromptVariant(seed.promptText, seed.category);
    const candidateVariantKey = normalizePromptKey(candidateVariant);

    if (!usage.blockedPromptKeys.has(candidateVariantKey)) {
      ranked.unshift({
        promptText: candidateVariant,
        category: seed.category,
        missCount: seed.missCount + 1,
        competitorCount: seed.competitorCount,
      });
    }
  }

  return ranked;
}

async function getRecentPromptUsage({
  supabase,
  brand,
  cycle,
}: {
  supabase: SupabaseClient;
  brand: BrandRecord;
  cycle: CycleRecord;
}): Promise<RecentPromptUsage> {
  const minCycleNumber = Math.max(1, cycle.cycle_number - PROMPT_REUSE_COOLDOWN_CYCLES);
  const { data: recentCycles } = await supabase
    .from("cycles")
    .select("id,cycle_number")
    .eq("brand_id", brand.id)
    .lt("cycle_number", cycle.cycle_number)
    .gte("cycle_number", minCycleNumber);

  const cycleIds = (recentCycles ?? []).map((item) => item.id as string);
  const cycleNumberById = new Map(
    (recentCycles ?? []).map((item) => [item.id as string, Number((item as { cycle_number: number }).cycle_number)]),
  );

  if (cycleIds.length === 0) {
    return {
      blockedPromptKeys: new Set<string>(),
      lastUsedCycleByPromptKey: new Map<string, number>(),
    };
  }

  const { data: recentContent } = await supabase
    .from("generated_content")
    .select("target_prompts,cycle_id")
    .eq("brand_id", brand.id)
    .in("cycle_id", cycleIds);

  const blockedPromptKeys = new Set<string>();
  const lastUsedCycleByPromptKey = new Map<string, number>();

  (recentContent ?? []).forEach((row) => {
    const typedRow = row as { target_prompts?: unknown; cycle_id?: string | null };
    const cycleNumber = cycleNumberById.get(typedRow.cycle_id ?? "") ?? 0;

    if (!Array.isArray(typedRow.target_prompts)) {
      return;
    }

    typedRow.target_prompts.forEach((prompt) => {
      const key = normalizePromptKey(String(prompt));
      blockedPromptKeys.add(key);
      const existing = lastUsedCycleByPromptKey.get(key) ?? 0;
      if (cycleNumber > existing) {
        lastUsedCycleByPromptKey.set(key, cycleNumber);
      }
    });
  });

  return {
    blockedPromptKeys,
    lastUsedCycleByPromptKey,
  };
}

async function researchInteractionPrompt(
  promptText: string,
  brand: BrandRecord,
  siteAnalysis: SiteAnalysisRecord | null,
) {
  const canonicalPromptText = canonicalizeIngredientMentions(promptText);
  const siteContext = buildSiteContext(siteAnalysis);
  const tierConfig = getTierAnalysisConfig(brand.subscription_tier);

  if (!tierConfig.models.includes("perplexity-sonar-pro")) {
    return {
      summary: `Draft this content around the interaction query "${canonicalPromptText}" using the brand's existing products, ingredients, and onboarding content signals. Prioritize trust-first guidance and plain language over promotional framing.`,
      sources: [],
    };
  }

  const researchResponse = await queryPerplexity(
    [
      "Research the supplement or wellness product interaction question below.",
      `Question: ${canonicalPromptText}`,
      `Brand: ${brand.brand_name}`,
      `Known products: ${siteContext.products.join(", ") || "Unknown"}`,
      `Known ingredients: ${siteContext.ingredients.join(", ") || "Unknown"}`,
      "Summarize the most useful evidence in concise prose suitable for a brand FAQ draft.",
      "Treat ingredient aliases as the same ingredient and prefer the canonical ingredient naming used in Known ingredients.",
      "Focus on safety context, interaction nuance, and trustworthy medical framing.",
      "Do not recommend speaking to a doctor unless a real safety caveat is central to the answer.",
    ].join("\n"),
  );

  return {
    summary: researchResponse.text,
    sources: filterAuthoritySources(researchResponse.citationUrls),
  };
}

function buildFallbackProductInteractionBody(
  brand: BrandRecord,
  promptText: string,
  sources: string[],
  siteAnalysis: SiteAnalysisRecord | null,
) {
  const siteContext = buildSiteContext(siteAnalysis);
  const productReference = siteContext.products[0] ?? brand.brand_name;
  const sourceLine =
    sources.length > 0
      ? `Supporting sources to review include ${sources.slice(0, 2).join(" and ")}.`
      : "Add external medical citations during review before publishing.";

  return [
    `Direct answer: ${promptText.replace(/\?$/, "")} depends on the ingredients involved, but most combinations should be explained in plain language with clear safety framing and dosage context.`,
    `For ${brand.brand_name}, the clearest approach is to publish a dedicated answer that explains how the relevant ingredients work together, when someone should be cautious, and which product from the range is most relevant. ${productReference} should be referenced naturally only where it genuinely fits the interaction question.`,
    `The final page should lead with the answer, follow with short context on why the combination may or may not make sense, then add a calm informational disclaimer for readers who want to explore further. ${sourceLine}`,
    "This content is for informational purposes only and does not constitute medical advice.",
  ].join(" ");
}

function buildFallbackFaqBody(
  brand: BrandRecord,
  promptText: string,
) {
  return [
    `Direct answer: ${promptText.replace(/\?$/, "")} should be answered in clear, practical language that makes the interaction or topic easy to understand.`,
    `For ${brand.brand_name}, keep the response concise, grounded, and tied to the relevant product or ingredient only where it genuinely helps the reader.`,
    "This content is for informational purposes only and does not constitute medical advice.",
  ].join(" ");
}

function buildFallbackFaqPrompt(prompts: PromptRecord[], siteAnalysis: SiteAnalysisRecord | null) {
  return canonicalizeIngredientMentions(
    (
    prompts.find((prompt) => prompt.prompt_category === "product_interaction")?.prompt_text ??
    prompts[0]?.prompt_text ??
    siteAnalysis?.content_signals?.faqTopics?.[0] ??
    "What should I know about using these products together?"
    ),
  );
}

async function generateProductInteractionArticle(
  brand: BrandRecord,
  promptText: string,
  siteAnalysis: SiteAnalysisRecord | null,
) {
  try {
    const canonicalPromptText = canonicalizeIngredientMentions(promptText);
    const siteContext = buildSiteContext(siteAnalysis);
    const research = await researchInteractionPrompt(canonicalPromptText, brand, siteAnalysis);
    const response = await queryOpenAi(
      [
        "You are a medical content writer for a consumer health brand.",
        `Brand: ${brand.brand_name}`,
        `Industry categories: ${brand.industry_tags.map(getIndustryLabel).join(", ") || "Unknown"}`,
        `Hero products/ingredients: ${[...siteContext.products, ...siteContext.ingredients].slice(0, 10).join(", ") || "Unknown"}`,
        `Query this content should answer: ${canonicalPromptText}`,
        `Research findings: ${research.summary}`,
        `Approved citations: ${research.sources.join(", ") || "None available"}`,
        "If two ingredient names refer to the same ingredient, collapse them into one canonical name instead of treating them as separate ingredients.",
        "Write a 200-300 word FAQ answer that directly answers the query, stays trustworthy, references the brand naturally where relevant, includes at least two provided citations inline when available, and ends with the disclaimer sentence exactly as written in the prompt spec.",
        'Return JSON only in the form {"title":"","body":"","cited_sources":[],"target_query":""}.',
      ].join("\n"),
    );

    const parsed = safeParseStructuredContent(response.text);

    if (parsed.success) {
      return {
        content_type: "product_interaction" as const,
        title: parsed.data.title,
        body: parsed.data.body,
        target_prompts: [canonicalizeIngredientMentions(parsed.data.target_query)],
        medical_sources: filterAuthoritySources(
          parsed.data.cited_sources.length > 0 ? parsed.data.cited_sources : research.sources,
        ),
      };
    }

    return {
      content_type: "product_interaction" as const,
      title: canonicalPromptText,
      body: buildFallbackProductInteractionBody(brand, canonicalPromptText, research.sources, siteAnalysis),
      target_prompts: [canonicalPromptText],
      medical_sources: research.sources,
    };
  } catch (error) {
    logContentGenerationError("product_interaction", error, { contentType: "product_interaction" });
    const canonicalPromptText = canonicalizeIngredientMentions(promptText);
    return {
      content_type: "product_interaction" as const,
      title: canonicalPromptText,
      body: buildFallbackProductInteractionBody(brand, canonicalPromptText, [], siteAnalysis),
      target_prompts: [canonicalPromptText],
      medical_sources: [],
    };
  }
}

async function generateFaqSnippet(
  brand: BrandRecord,
  promptText: string,
  siteAnalysis: SiteAnalysisRecord | null,
) {
  try {
    const canonicalPromptText = canonicalizeIngredientMentions(promptText);
    const siteContext = buildSiteContext(siteAnalysis);
    const response = await queryOpenAi(
      [
        "Write a concise FAQ snippet for a consumer health brand.",
        `Brand: ${brand.brand_name}`,
        `Question: ${canonicalPromptText}`,
        `Known products: ${siteContext.products.join(", ") || "Unknown"}`,
        `Known ingredients: ${siteContext.ingredients.join(", ") || "Unknown"}`,
        "If ingredient aliases refer to the same ingredient, use one canonical ingredient name consistently.",
        "Keep the answer around 90-140 words, lead with a direct answer, mention the brand naturally if relevant, and end with the disclaimer sentence exactly: This content is for informational purposes only and does not constitute medical advice.",
        'Return JSON only in the form {"title":"","body":"","cited_sources":[],"target_query":""}.',
      ].join("\n"),
    );

    const parsed = safeParseStructuredContent(response.text);

    if (parsed.success) {
      return {
        content_type: "faq_snippet" as const,
        title: parsed.data.title,
        body: parsed.data.body,
        target_prompts: [canonicalizeIngredientMentions(parsed.data.target_query)],
        medical_sources: [],
      };
    }

    return {
      content_type: "faq_snippet" as const,
      title: canonicalPromptText,
      body: buildFallbackFaqBody(brand, canonicalPromptText),
      target_prompts: [canonicalPromptText],
      medical_sources: [],
    };
  } catch (error) {
    logContentGenerationError("faq_snippet", error, { contentType: "faq_snippet" });
    const canonicalPromptText = canonicalizeIngredientMentions(promptText);
    return {
      content_type: "faq_snippet" as const,
      title: canonicalPromptText,
      body: buildFallbackFaqBody(brand, canonicalPromptText),
      target_prompts: [canonicalPromptText],
      medical_sources: [],
    };
  }
}

function generateLlmsTxtSnippet(brand: BrandRecord, siteAnalysis: SiteAnalysisRecord | null) {
  const siteContext = buildSiteContext(siteAnalysis);

  return {
    content_type: "llms_txt" as const,
    title: `${brand.brand_name} llms.txt starter block`,
    body: [
      `brand: ${brand.brand_name}`,
      `website: ${brand.website_url}`,
      `industry_categories: ${brand.industry_tags.map(getIndustryLabel).join(" | ") || "consumer health"}`,
      `products: ${siteContext.products.join(" | ") || "Add hero products here"}`,
      `ingredients: ${siteContext.ingredients.join(" | ") || "Add primary ingredients here"}`,
      `health_claims: ${siteContext.claims.join(" | ") || "Add substantiated health claims here"}`,
      `faq_topics: ${siteContext.faqTopics.join(" | ") || "Add priority FAQ topics here"}`,
      "content_principles: trust-first | evidence-aware | plain-language | non-promotional",
      "note: This content is for informational purposes only and does not constitute medical advice.",
    ].join("\n"),
    target_prompts: [],
    medical_sources: [],
  };
}

export async function generateCycleContent({
  brand,
  cycle,
  prompts,
  siteAnalysis,
  supabaseClient,
}: {
  brand: BrandRecord;
  cycle: CycleRecord;
  prompts: PromptRecord[];
  siteAnalysis: SiteAnalysisRecord | null;
  supabaseClient?: SupabaseClient;
}) {
  const tierConfig = getTierAnalysisConfig(brand.subscription_tier);
  const supabase = supabaseClient ?? createClient();
  const rowsToInsert: GeneratedContentInsert[] = [generateLlmsTxtSnippet(brand, siteAnalysis)];
  const recentPromptUsage = await getRecentPromptUsage({ supabase, brand, cycle });

  const interactionOpportunities = applyRecentPromptCooldown({
    opportunities: getPromptOpportunities(prompts, "product_interaction"),
    usage: recentPromptUsage,
  });
  const interactionPrompts = interactionOpportunities.slice(0, 5);
  const interactionKeys = new Set(interactionPrompts.map((o) => normalizePromptKey(o.promptText)));

  const faqSourceOpportunities = getPromptOpportunities(prompts).filter(
    (o) => !interactionKeys.has(normalizePromptKey(o.promptText)),
  );

  const topMissedPrompts = applyRecentPromptCooldown({
    opportunities: faqSourceOpportunities,
    usage: recentPromptUsage,
  }).slice(0, 3);
  const faqPrompts =
    topMissedPrompts.length > 0
      ? topMissedPrompts
      : [{ promptText: buildFallbackFaqPrompt(prompts, siteAnalysis) }];

  if (tierConfig.productInteractionContent) {
    for (const opportunity of interactionPrompts) {
      rowsToInsert.push(await generateProductInteractionArticle(brand, opportunity.promptText, siteAnalysis));
    }
  }

  for (const opportunity of faqPrompts) {
    rowsToInsert.push(await generateFaqSnippet(brand, opportunity.promptText, siteAnalysis));
  }

  const { error: deleteError } = await supabase
    .from("generated_content")
    .delete()
    .eq("brand_id", brand.id)
    .eq("cycle_id", cycle.id);

  if (deleteError) {
    logContentGenerationError("delete_existing", deleteError, { contentType: "generated_content" });
    throw new Error("Unable to reset generated content rows for this cycle.");
  }

  const { data, error } = await supabase
    .from("generated_content")
    .insert(
      rowsToInsert.map((row) => ({
        brand_id: brand.id,
        cycle_id: cycle.id,
        content_type: row.content_type,
        title: row.title,
        body: row.body,
        target_prompts: row.target_prompts,
        medical_sources: row.medical_sources,
      })),
    )
    .select("*")
    .returns<GeneratedContentRecord[]>();

  if (error) {
    logContentGenerationError("insert_generated_content", error, {
      contentType: "generated_content",
      rowCount: rowsToInsert.length,
    });
    throw new Error("Unable to store generated content.");
  }

  return data ?? [];
}
