import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TriggerCycleButton } from "@/components/dashboard/TriggerCycleButton";
import { VisibilityGraph } from "@/components/dashboard/VisibilityGraph";
import { getDashboardOverview } from "@/lib/dashboard";
import { formatRoundedValue, formatSignedRoundedValue } from "@/lib/formatting";
import { getSubscriptionPlan, getTierAnalysisConfig } from "@/lib/suppgo";
import { isSuppgoTestModeEnabled } from "@/lib/supabase/env";

function formatDelta(value: number | null, suffix = "%") {
  if (value === null) {
    return "Baseline";
  }

  return formatSignedRoundedValue(value, suffix);
}

export default async function DashboardPage() {
  const overview = await getDashboardOverview();

  if (!overview?.brand) {
    return null;
  }

  const plan = getSubscriptionPlan(overview.brand.subscription_tier);
  const tierConfig = getTierAnalysisConfig(overview.brand.subscription_tier);
  const testModeEnabled = isSuppgoTestModeEnabled();

  return (
    <div className="space-y-6">
      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
              Overview
            </div>
            <h2 className="mt-2 font-display text-3xl text-dark">
              Visibility intelligence for {overview.brand.brand_name}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-mid">
              The overview brings your current cycle performance, year-to-date visibility trend,
              category hit rates, and the clearest competitive content opportunities into one scan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="gold">{plan.name}</Badge>
            <Badge variant={testModeEnabled ? "gold" : "dark"}>
              {testModeEnabled ? "Test mode cap active" : "Tier limits active"}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-6">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            Current visibility score
          </div>
          <div className="mt-4 font-display text-4xl text-dark">
            {formatRoundedValue(overview.metrics.currentVisibilityScore)}
          </div>
          <p className="mt-3 text-sm leading-6 text-mid">0-100 visibility index for the latest completed cycle.</p>
        </Card>
        <Card className="p-6">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            Change vs. last cycle
          </div>
          <div className="mt-4 font-display text-4xl text-dark">
            {formatDelta(overview.metrics.visibilityDelta, "")}
          </div>
          <p className="mt-3 text-sm leading-6 text-mid">How your aggregate visibility moved since the prior completed cycle.</p>
        </Card>
        <Card className="p-6">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            Total prompts analyzed
          </div>
          <div className="mt-4 font-display text-4xl text-dark">{overview.metrics.totalPromptsAnalyzed}</div>
          <p className="mt-3 text-sm leading-6 text-mid">Prompt executions captured in the latest completed cycle.</p>
        </Card>
        <Card className="p-6">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            Mention rate
          </div>
          <div className="mt-4 font-display text-4xl text-dark">
            {formatRoundedValue(overview.metrics.mentionRate, "%")}
          </div>
          <p className="mt-3 text-sm leading-6 text-mid">Share of prompt executions where the brand appeared in the answer.</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <Card className="p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
                YTD visibility trend
              </div>
              <h3 className="mt-2 font-display text-2xl text-dark">Cross-model performance over time</h3>
            </div>
            <Badge>{overview.latestCompletedCycle ? `Cycle #${overview.latestCompletedCycle.cycle_number}` : "Awaiting first cycle"}</Badge>
          </div>
          <div className="mt-6">
            <VisibilityGraph
              data={overview.trend}
              showPlaceholderLabel={overview.hasPlaceholderTrend}
            />
          </div>
        </Card>

        <Card className="p-6 md:p-8">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            Site readiness
          </div>
          <h3 className="mt-2 font-display text-2xl text-dark">Crawler and profile context</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-mid">
            <p>Website: {overview.brand.website_url}</p>
            <p>
              Latest crawl:{" "}
              {overview.latestSiteAnalysis?.crawled_at
                ? new Date(overview.latestSiteAnalysis.crawled_at).toLocaleDateString()
                : "Not yet analyzed"}
            </p>
            <p>Pages analyzed: {overview.latestSiteAnalysis?.pages_analyzed ?? 0}</p>
            <p>Tracked competitors: {overview.brand.competitor_urls.length}</p>
            <p>Detected content gaps: {overview.latestSiteAnalysis?.missing_content_gaps.length ?? 0}</p>
          </div>
          <div className="mt-6">
            <TriggerCycleButton />
          </div>
          <p className="mt-4 text-xs leading-6 text-mid">
            When test mode is enabled, the runner trims the cycle before model dispatch so total
            executions never exceed ten.
          </p>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {overview.categoryBreakdown.map((item) => (
          <Card key={item.category} className="p-6">
            <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
              {item.label}
            </div>
            <div className="mt-4 font-display text-3xl text-dark">
              {formatRoundedValue(item.hitRate, "%")}
            </div>
            <p className="mt-2 text-sm text-mid">Hit rate across {item.promptCount} prompt executions.</p>
            <div className="mt-4 text-xs uppercase tracking-[1.4px] text-mid">
              Delta vs. last cycle: {formatDelta(item.delta)}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
                Top competitor mentions
              </div>
              <h3 className="mt-2 font-display text-2xl text-dark">Where competitors are outranking you</h3>
            </div>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-mid">
              <thead>
                <tr className="border-b border-sage/12 text-xs uppercase tracking-[1.4px] text-sage">
                  <th className="pb-3 pr-4">Competitor</th>
                  <th className="pb-3 pr-4">Mentions</th>
                  <th className="pb-3 pr-4">Vs. client</th>
                  <th className="pb-3">Gap prompts</th>
                </tr>
              </thead>
              <tbody>
                {tierConfig.competitorBenchmarking ? (
                  overview.competitorRows.length > 0 ? (
                    overview.competitorRows.map((row) => (
                      <tr key={row.competitorName} className="border-b border-sage/8">
                        <td className="py-4 pr-4 font-medium text-dark">{row.competitorName}</td>
                        <td className="py-4 pr-4">{row.mentionCount}</td>
                        <td className="py-4 pr-4">
                          {row.vsClientMentionCount >= 0 ? "+" : ""}
                          {row.vsClientMentionCount}
                        </td>
                        <td className="py-4">
                          {overview.latestCompletedCycle ? (
                            <a
                              href={`/reports/${overview.latestCompletedCycle.id}#gap-analysis`}
                              className="text-sage underline-offset-4 hover:underline"
                            >
                              {row.gapPromptCount} gap prompts
                            </a>
                          ) : (
                            `${row.gapPromptCount} gap prompts`
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-mid">
                        Competitor benchmarking will populate after completed cycles collect prompt-level gap data.
                      </td>
                    </tr>
                  )
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-mid">
                      Competitor benchmarking is available on Growth and Pro plans.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6 md:p-8">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            Content opportunities
          </div>
          <h3 className="mt-2 font-display text-2xl text-dark">Highest-leverage editorial next steps</h3>
          <div className="mt-6 space-y-4">
            {overview.contentOpportunities.map((opportunity) => (
              <div key={opportunity} className="rounded-card border border-sage/12 bg-sage/5 p-4 text-sm leading-7 text-mid">
                {opportunity}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
              Latest generated content
            </div>
            <h3 className="mt-2 font-display text-2xl text-dark">Cycle-linked drafts ready for review</h3>
          </div>
          <a href="/reports" className="btn-outline px-5 py-2.5">
            View reports
          </a>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {overview.latestGeneratedContent.length > 0 ? (
            overview.latestGeneratedContent.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-card border border-sage/12 bg-white p-5">
                <div className="text-xs font-medium uppercase tracking-[1.4px] text-sage">
                  {item.content_type.replaceAll("_", " ")}
                </div>
                <div className="mt-3 font-medium text-dark">{item.title ?? "Untitled draft"}</div>
                <p className="mt-3 text-sm leading-6 text-mid">
                  {item.body.slice(0, 180)}
                  {item.body.length > 180 ? "..." : ""}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-card border border-sage/12 bg-white p-5 text-sm leading-6 text-mid md:col-span-3">
              {tierConfig.productInteractionContent
                ? "Generated product interaction drafts, FAQ snippets, and llms.txt recommendations appear here after a completed cycle finishes post-processing."
                : "FAQ snippets and llms.txt recommendations appear here after a completed cycle finishes post-processing. Product interaction drafts unlock on Growth and Pro."}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
