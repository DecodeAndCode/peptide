import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getWeightedVisibilityScore, toVisibilityIndex } from "@/lib/analysis/visibility";
import { PROMPT_CATEGORY_LABELS } from "@/lib/suppgo";
import type {
  BrandRecord,
  CycleRecord,
  GeneratedContentRecord,
  PromptCategory,
  PromptModel,
  PromptRecord,
  ReportRecord,
  SiteAnalysisRecord,
} from "@/types";

interface MetricSummary {
  currentVisibilityScore: number;
  visibilityDelta: number | null;
  totalPromptsAnalyzed: number;
  mentionRate: number;
}

interface VisibilityTrendPoint {
  cycleId: string;
  cycleLabel: string;
  cycleDate: string;
  average: number;
  "gpt-4o": number | null;
  "claude-sonnet": number | null;
  "perplexity-sonar-pro": number | null;
}

interface CategoryBreakdownCard {
  category: PromptCategory;
  label: string;
  hitRate: number;
  delta: number | null;
  promptCount: number;
}

interface CompetitorTableRow {
  competitorName: string;
  mentionCount: number;
  vsClientMentionCount: number;
  gapPromptCount: number;
  gapPromptPreview: string[];
}

interface ReportListItem {
  cycle: CycleRecord;
  delta: number | null;
  report: ReportRecord | null;
}

export interface DashboardOverviewData {
  brand: BrandRecord;
  latestSiteAnalysis: SiteAnalysisRecord | null;
  latestCycle: CycleRecord | null;
  latestCompletedCycle: CycleRecord | null;
  previousCompletedCycle: CycleRecord | null;
  metrics: MetricSummary;
  trend: VisibilityTrendPoint[];
  hasPlaceholderTrend: boolean;
  categoryBreakdown: CategoryBreakdownCard[];
  competitorRows: CompetitorTableRow[];
  contentOpportunities: string[];
  latestGeneratedContent: GeneratedContentRecord[];
}

export interface PromptResultRowData {
  id: string;
  promptText: string;
  category: PromptCategory;
  model: PromptModel;
  mentioned: boolean;
  mentionRank: number | null;
  mentionContext: string | null;
  sentiment: string | null;
  competitorsMentioned: string[];
}

export interface CategoryPerformanceRow {
  category: PromptCategory;
  label: string;
  "gpt-4o": number;
  "claude-sonnet": number;
  "perplexity-sonar-pro": number;
}

export interface CompetitorGapRow {
  promptText: string;
  category: PromptCategory;
  competitors: string[];
  likelyReason: string;
  suggestedFix: string;
}

export interface ExecutiveSummaryData {
  visibilityScore: number;
  visibilityDelta: number | null;
  mentionRate: number;
  totalPromptExecutions: number;
  topWin: string;
  topMiss: string;
  summaryText: string;
}

export interface CycleReportData {
  brand: BrandRecord;
  cycle: CycleRecord;
  previousCycle: CycleRecord | null;
  latestSiteAnalysis: SiteAnalysisRecord | null;
  prompts: PromptResultRowData[];
  generatedContent: GeneratedContentRecord[];
  report: ReportRecord | null;
  executiveSummary: ExecutiveSummaryData;
  categoryPerformance: CategoryPerformanceRow[];
  competitorGaps: CompetitorGapRow[];
  hits: PromptResultRowData[];
  misses: PromptResultRowData[];
  influencerPreview: Array<{ title: string; description: string; href: string }>;
}

const PLACEHOLDER_TREND: VisibilityTrendPoint[] = [
  {
    cycleId: "demo-1",
    cycleLabel: "Jan",
    cycleDate: "Jan",
    average: 36,
    "gpt-4o": 38,
    "claude-sonnet": 34,
    "perplexity-sonar-pro": 0,
  },
  {
    cycleId: "demo-2",
    cycleLabel: "Feb",
    cycleDate: "Feb",
    average: 42,
    "gpt-4o": 44,
    "claude-sonnet": 40,
    "perplexity-sonar-pro": 0,
  },
  {
    cycleId: "demo-3",
    cycleLabel: "Mar",
    cycleDate: "Mar",
    average: 49,
    "gpt-4o": 50,
    "claude-sonnet": 48,
    "perplexity-sonar-pro": 0,
  },
];

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function getCycleDateLabel(cycle: CycleRecord) {
  const value = cycle.completed_at ?? cycle.created_at;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getCycleMonthLabel(cycle: CycleRecord) {
  const value = cycle.completed_at ?? cycle.created_at;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
  });
}

function buildPromptRows(prompts: PromptRecord[]): PromptResultRowData[] {
  return prompts.map((prompt) => ({
    id: prompt.id,
    promptText: prompt.prompt_text,
    category: prompt.prompt_category,
    model: prompt.model,
    mentioned: prompt.brand_mentioned,
    mentionRank: prompt.mention_rank,
    mentionContext: prompt.mention_context,
    sentiment: prompt.sentiment,
    competitorsMentioned: prompt.competitors_mentioned ?? [],
  }));
}

function getMentionRate(prompts: PromptRecord[]) {
  if (prompts.length === 0) {
    return 0;
  }

  const mentions = prompts.filter((prompt) => prompt.brand_mentioned).length;
  return roundPercent((mentions / prompts.length) * 100);
}

function getVisibilityIndex(prompts: PromptRecord[]) {
  const totalScore = prompts.reduce(
    (sum, prompt) => sum + getWeightedVisibilityScore(prompt.prompt_category, prompt.mention_rank),
    0,
  );
  return toVisibilityIndex(totalScore, prompts.length);
}

function getCategoryHitRate(prompts: PromptRecord[], category: PromptCategory) {
  const categoryPrompts = prompts.filter((prompt) => prompt.prompt_category === category);

  if (categoryPrompts.length === 0) {
    return 0;
  }

  return roundPercent(
    (categoryPrompts.filter((prompt) => prompt.brand_mentioned).length / categoryPrompts.length) * 100,
  );
}

function getCategoryBreakdown(currentPrompts: PromptRecord[], previousPrompts: PromptRecord[]) {
  return (Object.keys(PROMPT_CATEGORY_LABELS) as PromptCategory[]).map((category) => {
    const currentHitRate = getCategoryHitRate(currentPrompts, category);
    const previousHitRate = previousPrompts.length > 0 ? getCategoryHitRate(previousPrompts, category) : null;

    return {
      category,
      label: PROMPT_CATEGORY_LABELS[category],
      hitRate: currentHitRate,
      delta: previousHitRate === null ? null : roundPercent(currentHitRate - previousHitRate),
      promptCount: currentPrompts.filter((prompt) => prompt.prompt_category === category).length,
    };
  });
}

function getCompetitorRows(prompts: PromptRecord[]) {
  const competitorMap = new Map<
    string,
    {
      mentionCount: number;
      gapPrompts: Set<string>;
    }
  >();

  const clientMentionCount = prompts.filter((prompt) => prompt.brand_mentioned).length;

  prompts.forEach((prompt) => {
    const competitors = prompt.competitors_mentioned ?? [];

    competitors.forEach((competitor) => {
      const existing = competitorMap.get(competitor) ?? {
        mentionCount: 0,
        gapPrompts: new Set<string>(),
      };
      existing.mentionCount += 1;

      if (!prompt.brand_mentioned) {
        existing.gapPrompts.add(prompt.prompt_text);
      }

      competitorMap.set(competitor, existing);
    });
  });

  return Array.from(competitorMap.entries())
    .map(([competitorName, value]) => ({
      competitorName,
      mentionCount: value.mentionCount,
      vsClientMentionCount: value.mentionCount - clientMentionCount,
      gapPromptCount: value.gapPrompts.size,
      gapPromptPreview: Array.from(value.gapPrompts).slice(0, 3),
    }))
    .sort((left, right) => right.mentionCount - left.mentionCount)
    .slice(0, 8);
}

function buildOpportunityText(topic: string, category: PromptCategory) {
  if (category === "product_interaction") {
    return `You are frequently missing product interaction coverage around ${topic}. Adding a trust-first FAQ and supporting article on this stack could improve answer inclusion.`;
  }

  if (category === "problem_solution") {
    return `Problem-solution queries around ${topic} are underperforming. Strengthening educational guidance tied to your relevant products would close the gap.`;
  }

  if (category === "explicit_recommendation") {
    return `Recommendation-style prompts tied to ${topic} are favoring competitors. Clear comparison copy and stronger authority signals would help SuppGo surface your brand more often.`;
  }

  return `Ingredient education prompts mentioning ${topic} are being won elsewhere. A concise explainer with citations and brand context should improve visibility.`;
}

function getContentOpportunities(
  prompts: PromptRecord[],
  generatedContent: GeneratedContentRecord[],
  siteAnalysis: SiteAnalysisRecord | null,
) {
  const gapPrompts = prompts
    .filter((prompt) => !prompt.brand_mentioned)
    .sort((left, right) => (right.competitors_mentioned?.length ?? 0) - (left.competitors_mentioned?.length ?? 0));

  const generatedTitles = new Set(
    generatedContent.map((item) => (item.title ?? "").toLowerCase()).filter(Boolean),
  );
  const recommendations: string[] = [];

  for (const prompt of gapPrompts) {
    const topic = prompt.prompt_text.replace(/\?$/, "");
    const recommendation = buildOpportunityText(topic, prompt.prompt_category);

    if (!generatedTitles.has(topic.toLowerCase()) && !recommendations.includes(recommendation)) {
      recommendations.push(recommendation);
    }

    if (recommendations.length >= 4) {
      break;
    }
  }

  if (recommendations.length < 4) {
    for (const gap of siteAnalysis?.missing_content_gaps ?? []) {
      recommendations.push(
        `Your onboarding crawl flagged "${gap}" as a content gap. Publishing a crawlable page for this topic would strengthen both search and LLM retrieval coverage.`,
      );

      if (recommendations.length >= 4) {
        break;
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Your first completed cycle will surface the highest-priority content opportunities here, including missed recommendation, education, and product interaction themes.",
    );
  }

  return recommendations.slice(0, 5);
}

function getTrendData(cycles: CycleRecord[], prompts: PromptRecord[]) {
  const promptMap = new Map<string, PromptRecord[]>();

  prompts.forEach((prompt) => {
    const existing = promptMap.get(prompt.cycle_id) ?? [];
    existing.push(prompt);
    promptMap.set(prompt.cycle_id, existing);
  });

  return cycles.map((cycle) => {
    const cyclePrompts = promptMap.get(cycle.id) ?? [];
    const models: PromptModel[] = ["gpt-4o", "claude-sonnet", "perplexity-sonar-pro"];
    const series = Object.fromEntries(
      models.map((model) => {
        const modelPrompts = cyclePrompts.filter((prompt) => prompt.model === model);
        return [model, modelPrompts.length > 0 ? getVisibilityIndex(modelPrompts) : null];
      }),
    ) as Record<PromptModel, number | null>;

    return {
      cycleId: cycle.id,
      cycleLabel: getCycleMonthLabel(cycle),
      cycleDate: getCycleDateLabel(cycle),
      average: cycle.visibility_score ?? getVisibilityIndex(cyclePrompts),
      "gpt-4o": series["gpt-4o"],
      "claude-sonnet": series["claude-sonnet"],
      "perplexity-sonar-pro": series["perplexity-sonar-pro"],
    };
  });
}

function getLikelyReason(prompt: PromptResultRowData) {
  if (prompt.category === "product_interaction") {
    return "The brand lacks a dedicated interaction or stack-specific answer that models can reliably quote.";
  }

  if (prompt.category === "explicit_recommendation") {
    return "Competitors are being surfaced more often in list-style recommendation answers, likely due to stronger retrieval signals or category familiarity.";
  }

  if (prompt.category === "problem_solution") {
    return "The prompt implies a symptom-led intent, but the current site content may not connect the problem to the brand clearly enough.";
  }

  return "The site likely needs a clearer educational explainer with stronger authority signals for this topic.";
}

function getSuggestedFix(prompt: PromptResultRowData) {
  if (prompt.category === "product_interaction") {
    return "Publish a direct FAQ or article answering the interaction question, then reinforce it in llms.txt and supporting product pages.";
  }

  if (prompt.category === "explicit_recommendation") {
    return "Add comparison-ready copy, clearer category positioning, and structured proof points to improve inclusion in ranked responses.";
  }

  if (prompt.category === "problem_solution") {
    return "Create symptom-led educational content that naturally references the relevant product and supporting evidence.";
  }

  return "Expand ingredient education with plain-language explanations, authority citations, and a clear product fit.";
}

function getCategoryPerformance(prompts: PromptRecord[]) {
  return (Object.keys(PROMPT_CATEGORY_LABELS) as PromptCategory[]).map((category) => {
    const byModel = {
      "gpt-4o": 0,
      "claude-sonnet": 0,
      "perplexity-sonar-pro": 0,
    };

    (Object.keys(byModel) as PromptModel[]).forEach((model) => {
      const scoped = prompts.filter((prompt) => prompt.prompt_category === category && prompt.model === model);

      if (scoped.length > 0) {
        byModel[model] = roundPercent(
          (scoped.filter((prompt) => prompt.brand_mentioned).length / scoped.length) * 100,
        );
      }
    });

    return {
      category,
      label: PROMPT_CATEGORY_LABELS[category],
      ...byModel,
    };
  });
}

function getCompetitorGaps(prompts: PromptRecord[]) {
  return prompts
    .filter((prompt) => !prompt.brand_mentioned && (prompt.competitors_mentioned?.length ?? 0) > 0)
    .map((prompt) => {
      const row = buildPromptRows([prompt])[0];
      return {
        promptText: prompt.prompt_text,
        category: prompt.prompt_category,
        competitors: prompt.competitors_mentioned ?? [],
        likelyReason: getLikelyReason(row),
        suggestedFix: getSuggestedFix(row),
      };
    })
    .slice(0, 8);
}

function getExecutiveSummary(
  cycle: CycleRecord,
  previousCycle: CycleRecord | null,
  prompts: PromptRecord[],
): ExecutiveSummaryData {
  const visibilityScore = cycle.visibility_score ?? getVisibilityIndex(prompts);
  const visibilityDelta =
    previousCycle?.visibility_score !== null && previousCycle?.visibility_score !== undefined
      ? roundPercent(visibilityScore - previousCycle.visibility_score)
      : null;
  const mentionRate = getMentionRate(prompts);

  const wins = prompts
    .filter((prompt) => prompt.brand_mentioned)
    .sort((left, right) => (left.mention_rank ?? 99) - (right.mention_rank ?? 99));
  const misses = prompts
    .filter((prompt) => !prompt.brand_mentioned)
    .sort((left, right) => (right.competitors_mentioned?.length ?? 0) - (left.competitors_mentioned?.length ?? 0));

  const topWin =
    wins[0]?.prompt_text ??
    "Your first cycle will surface the strongest prompt patterns once more data has accumulated.";
  const topMiss =
    misses[0]?.prompt_text ??
    "No major misses were recorded in this cycle.";

  return {
    visibilityScore,
    visibilityDelta,
    mentionRate,
    totalPromptExecutions: prompts.length,
    topWin,
    topMiss,
    summaryText:
      visibilityDelta === null
        ? `Cycle #${cycle.cycle_number} established your baseline visibility across ${prompts.length} prompt executions, with a ${mentionRate}% mention rate.`
        : `Cycle #${cycle.cycle_number} closed at ${visibilityScore.toFixed(1)} visibility, ${visibilityDelta >= 0 ? "up" : "down"} ${Math.abs(visibilityDelta).toFixed(1)} points from the previous cycle, with a ${mentionRate}% mention rate.`,
  };
}

async function getCurrentBrandContext() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BrandRecord>();

  if (!brand) {
    return null;
  }

  const [{ data: latestCycle }, { data: latestSiteAnalysis }, { data: cycles }, { data: reports }] =
    await Promise.all([
      supabase
        .from("cycles")
        .select("*")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<CycleRecord>(),
      supabase
        .from("site_analyses")
        .select("*")
        .eq("brand_id", brand.id)
        .order("crawled_at", { ascending: false })
        .limit(1)
        .maybeSingle<SiteAnalysisRecord>(),
      supabase
        .from("cycles")
        .select("*")
        .eq("brand_id", brand.id)
        .eq("status", "complete")
        .order("completed_at", { ascending: true })
        .returns<CycleRecord[]>(),
      supabase
        .from("reports")
        .select("*")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false })
        .returns<ReportRecord[]>(),
    ]);

  const completedCycles = cycles ?? [];
  const latestCompletedCycle = completedCycles.at(-1) ?? null;
  const previousCompletedCycle = completedCycles.length > 1 ? completedCycles.at(-2) ?? null : null;
  const completedCycleIds = completedCycles.map((cycle) => cycle.id);

  const [{ data: prompts }, { data: generatedContent }] = await Promise.all([
    completedCycleIds.length > 0
      ? supabase
          .from("prompts")
          .select("*")
          .in("cycle_id", completedCycleIds)
          .order("created_at", { ascending: true })
          .returns<PromptRecord[]>()
      : Promise.resolve({ data: [] as PromptRecord[] }),
    latestCompletedCycle
      ? supabase
          .from("generated_content")
          .select("*")
          .eq("brand_id", brand.id)
          .eq("cycle_id", latestCompletedCycle.id)
          .order("created_at", { ascending: true })
          .returns<GeneratedContentRecord[]>()
      : Promise.resolve({ data: [] as GeneratedContentRecord[] }),
  ]);

  return {
    brand,
    latestCycle: latestCycle ?? null,
    latestSiteAnalysis: latestSiteAnalysis ?? null,
    completedCycles,
    latestCompletedCycle,
    previousCompletedCycle,
    prompts: prompts ?? [],
    generatedContent: generatedContent ?? [],
    reports: reports ?? [],
  };
}

export const getDashboardOverview = cache(async (): Promise<DashboardOverviewData | null> => {
  const context = await getCurrentBrandContext();

  if (!context) {
    return null;
  }

  const latestPrompts = context.latestCompletedCycle
    ? context.prompts.filter((prompt) => prompt.cycle_id === context.latestCompletedCycle?.id)
    : [];
  const previousPrompts = context.previousCompletedCycle
    ? context.prompts.filter((prompt) => prompt.cycle_id === context.previousCompletedCycle?.id)
    : [];

  return {
    brand: context.brand,
    latestSiteAnalysis: context.latestSiteAnalysis,
    latestCycle: context.latestCycle,
    latestCompletedCycle: context.latestCompletedCycle,
    previousCompletedCycle: context.previousCompletedCycle,
    metrics: {
      currentVisibilityScore: context.latestCompletedCycle?.visibility_score ?? getVisibilityIndex(latestPrompts),
      visibilityDelta:
        context.latestCompletedCycle && context.previousCompletedCycle?.visibility_score !== null
          ? roundPercent(
              (context.latestCompletedCycle.visibility_score ?? getVisibilityIndex(latestPrompts)) -
                (context.previousCompletedCycle?.visibility_score ?? 0),
            )
          : null,
      totalPromptsAnalyzed: latestPrompts.length,
      mentionRate: getMentionRate(latestPrompts),
    },
    trend:
      context.completedCycles.length >= 2
        ? getTrendData(context.completedCycles, context.prompts)
        : PLACEHOLDER_TREND,
    hasPlaceholderTrend: context.completedCycles.length < 2,
    categoryBreakdown: getCategoryBreakdown(latestPrompts, previousPrompts),
    competitorRows: getCompetitorRows(latestPrompts),
    contentOpportunities: getContentOpportunities(
      latestPrompts,
      context.generatedContent,
      context.latestSiteAnalysis,
    ),
    latestGeneratedContent: context.generatedContent,
  };
});

export const getReportsList = cache(async (): Promise<ReportListItem[] | null> => {
  const context = await getCurrentBrandContext();

  if (!context) {
    return null;
  }

  return [...context.completedCycles]
    .reverse()
    .map((cycle, index, allCycles) => {
      const priorCycle = allCycles[index + 1] ?? null;
      const delta =
        cycle.visibility_score !== null &&
        cycle.visibility_score !== undefined &&
        priorCycle?.visibility_score !== null &&
        priorCycle?.visibility_score !== undefined
          ? roundPercent(cycle.visibility_score - priorCycle.visibility_score)
          : null;

      return {
        cycle,
        delta,
        report: context.reports.find((report) => report.cycle_id === cycle.id) ?? null,
      };
    });
});

export const getCycleReportData = cache(async (cycleId: string): Promise<CycleReportData | null> => {
  const context = await getCurrentBrandContext();

  if (!context) {
    return null;
  }

  const cycle = context.completedCycles.find((item) => item.id === cycleId);

  if (!cycle) {
    return null;
  }

  const cycleIndex = context.completedCycles.findIndex((item) => item.id === cycle.id);
  const previousCycle = cycleIndex > 0 ? context.completedCycles[cycleIndex - 1] : null;
  const supabase = createClient();
  const [{ data: prompts }, { data: generatedContent }] = await Promise.all([
    supabase
      .from("prompts")
      .select("*")
      .eq("cycle_id", cycle.id)
      .order("created_at", { ascending: true })
      .returns<PromptRecord[]>(),
    supabase
      .from("generated_content")
      .select("*")
      .eq("brand_id", context.brand.id)
      .eq("cycle_id", cycle.id)
      .order("created_at", { ascending: true })
      .returns<GeneratedContentRecord[]>(),
  ]);

  const promptRecords = prompts ?? [];
  const rows = buildPromptRows(promptRecords);
  const hits = rows.filter((row) => row.mentioned);
  const misses = rows.filter((row) => !row.mentioned);

  return {
    brand: context.brand,
    cycle,
    previousCycle,
    latestSiteAnalysis: context.latestSiteAnalysis,
    prompts: rows,
    generatedContent: generatedContent ?? [],
    report: context.reports.find((report) => report.cycle_id === cycle.id) ?? null,
    executiveSummary: getExecutiveSummary(cycle, previousCycle, promptRecords),
    categoryPerformance: getCategoryPerformance(promptRecords),
    competitorGaps: getCompetitorGaps(promptRecords),
    hits,
    misses,
    influencerPreview: [
      {
        title: "Influencer matching unlock",
        description:
          "Pro plans can layer public-web influencer discovery on top of this gap analysis once Step 13 is enabled.",
        href: "/dashboard/influencers",
      },
      {
        title: "Biohacking and wellness angles",
        description:
          "Cycle gaps help shape the creator niches that should be targeted first when influencer matching is active.",
        href: "/dashboard/influencers",
      },
      {
        title: "Outreach copy will follow report themes",
        description:
          "SuppGo will eventually use the same winning and missing prompt patterns to tailor creator outreach messaging.",
        href: "/dashboard/influencers",
      },
    ],
  };
});
