import "server-only";
import { generateCycleContent } from "@/lib/analysis/content-generator";
import { generatePromptLibrary } from "@/lib/analysis/prompt-engine";
import { runPromptAcrossModels } from "@/lib/llm/aggregator";
import { generateAndStoreCycleReport } from "@/lib/reports/report-service";
import { getSuppgoTestModePromptExecutionCap, isSuppgoTestModeEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getTierAnalysisConfig } from "@/lib/suppgo";
import type { BrandRecord, CycleRecord, CycleRunSummary, PromptRecord, SiteAnalysisRecord } from "@/types";

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function isTrialExpired(brand: BrandRecord) {
  if (brand.subscription_status !== "trial" || !brand.trial_ends_at) {
    return false;
  }

  return new Date(brand.trial_ends_at).getTime() < Date.now();
}

function applyTestModeCap<T>(items: T[], modelCount: number) {
  const testModeEnabled = isSuppgoTestModeEnabled();

  if (!testModeEnabled) {
    return {
      items,
      testModeApplied: false,
    };
  }

  const maxExecutions = getSuppgoTestModePromptExecutionCap();
  const maxTemplates = Math.max(1, Math.floor(maxExecutions / modelCount));

  return {
    items: items.slice(0, maxTemplates),
    testModeApplied: items.length > maxTemplates,
  };
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>,
) {
  const results: TResult[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const nextIndex = currentIndex;
      currentIndex += 1;
      results[nextIndex] = await mapper(items[nextIndex], nextIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker()),
  );

  return results;
}

export async function runAnalysisCycle({
  brand,
  siteAnalysis,
}: {
  brand: BrandRecord;
  siteAnalysis: SiteAnalysisRecord | null;
}): Promise<CycleRunSummary> {
  if (!brand.onboarding_complete) {
    throw new Error("Complete onboarding before running a cycle.");
  }

  if (brand.subscription_status === "cancelled") {
    throw new Error("Reactivate the subscription before starting a new cycle.");
  }

  if (isTrialExpired(brand)) {
    throw new Error("The free trial has ended. Update billing before starting a new cycle.");
  }

  const supabase = createClient();
  const config = getTierAnalysisConfig(brand.subscription_tier);
  const promptLibrary = generatePromptLibrary({
    brand,
    siteAnalysis,
  });
  const { items: selectedPromptTemplates, testModeApplied } = applyTestModeCap(
    promptLibrary,
    config.models.length,
  );

  if (selectedPromptTemplates.length === 0) {
    throw new Error("No prompts were generated for this brand.");
  }

  const { data: latestCycle } = await supabase
    .from("cycles")
    .select("cycle_number")
    .eq("brand_id", brand.id)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<CycleRecord, "cycle_number">>();

  const cycleNumber = (latestCycle?.cycle_number ?? 0) + 1;
  const startedAt = new Date().toISOString();
  const expectedExecutions = selectedPromptTemplates.length * config.models.length;

  const { data: cycle, error: cycleInsertError } = await supabase
    .from("cycles")
    .insert({
      brand_id: brand.id,
      status: "running",
      cycle_number: cycleNumber,
      models_queried: config.models,
      total_prompts: expectedExecutions,
      started_at: startedAt,
    })
    .select("*")
    .single<CycleRecord>();

  if (cycleInsertError || !cycle) {
    throw new Error("Unable to create the cycle.");
  }

  try {
    const promptBatches = await mapWithConcurrency(
      selectedPromptTemplates,
      3,
      async ({ promptText, promptCategory }) =>
        runPromptAcrossModels({
          brand,
          siteAnalysis,
          promptText,
          promptCategory,
          models: config.models,
          includeCompetitors: true,
        }),
    );

    const results = promptBatches.flat();

    if (results.length === 0) {
      throw new Error("The cycle produced no prompt results.");
    }

    const mentionCount = results.filter((result) => result.brandMentioned).length;
    const visibilityScore = roundToTwoDecimals(
      (results.reduce((sum, result) => sum + result.visibilityScore, 0) / results.length) * 100,
    );

    const { error: promptInsertError } = await supabase.from("prompts").insert(
      results.map((result) => ({
        cycle_id: cycle.id,
        brand_id: brand.id,
        prompt_text: result.promptText,
        prompt_category: result.promptCategory,
        model: result.model,
        raw_response: result.rawResponse,
        citation_urls: result.citationUrls,
        brand_mentioned: result.brandMentioned,
        mention_rank: result.mentionRank,
        mention_context: result.mentionContext,
        competitors_mentioned: result.competitorsMentioned,
        sentiment: result.sentiment,
      })),
    );

    if (promptInsertError) {
      throw new Error("Unable to store prompt results.");
    }

    const { error: cycleUpdateError } = await supabase
      .from("cycles")
      .update({
        status: "complete",
        total_prompts: results.length,
        mention_count: mentionCount,
        visibility_score: visibilityScore,
        completed_at: new Date().toISOString(),
      })
      .eq("id", cycle.id);

    if (cycleUpdateError) {
      throw new Error("Unable to finalize the cycle.");
    }

    const promptRecordsForPostProcessing: PromptRecord[] = results.map((result, index) => ({
      id: `${cycle.id}-${index}`,
      cycle_id: cycle.id,
      brand_id: brand.id,
      prompt_text: result.promptText,
      prompt_category: result.promptCategory,
      model: result.model,
      raw_response: result.rawResponse,
      citation_urls: result.citationUrls,
      brand_mentioned: result.brandMentioned,
      mention_rank: result.mentionRank,
      mention_context: result.mentionContext,
      competitors_mentioned: result.competitorsMentioned,
      sentiment: result.sentiment,
      created_at: new Date().toISOString(),
    }));

    try {
      await generateCycleContent({
        brand,
        cycle: {
          ...cycle,
          status: "complete",
          total_prompts: results.length,
          mention_count: mentionCount,
          visibility_score: visibilityScore,
          completed_at: new Date().toISOString(),
        },
        prompts: promptRecordsForPostProcessing,
        siteAnalysis,
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      await generateAndStoreCycleReport({
        cycleId: cycle.id,
        recipientEmail: user?.email ?? null,
        sendEmail: true,
      });
    } catch {
      // Keep the analysis cycle marked complete even if post-cycle deliverables need a manual retry.
    }

    return {
      cycleId: cycle.id,
      cycleNumber,
      totalPromptTemplates: selectedPromptTemplates.length,
      totalPromptExecutions: results.length,
      modelsQueried: config.models,
      mentionCount,
      visibilityScore,
      testModeApplied,
    };
  } catch (error) {
    await supabase
      .from("cycles")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", cycle.id);

    throw error;
  }
}
