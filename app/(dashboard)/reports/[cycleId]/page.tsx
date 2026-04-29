import { notFound } from "next/navigation";
import { CategoryPerformanceChart } from "@/components/dashboard/CategoryPerformanceChart";
import { CmsDeployButton } from "@/components/dashboard/CmsDeployButton";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { PromptResultsTable } from "@/components/dashboard/PromptResultsTable";
import { ReportActionButtons } from "@/components/dashboard/ReportActionButtons";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { getCycleReportData } from "@/lib/dashboard";
import { formatRoundedValue, formatSignedRoundedValue } from "@/lib/formatting";
import { getWebflowIntegrationStatus } from "@/lib/integrations";
import { getTierAnalysisConfig } from "@/lib/suppgo";

function formatDelta(value: number | null) {
  if (value === null) {
    return "Baseline";
  }

  return formatSignedRoundedValue(value);
}

export default async function CycleReportPage({
  params,
}: {
  params: { cycleId: string };
}) {
  const report = await getCycleReportData(params.cycleId);

  if (!report) {
    notFound();
  }

  const siteSignals = report.latestSiteAnalysis?.content_signals;
  const tierConfig = getTierAnalysisConfig(report.brand.subscription_tier);
  const webflowIntegration = await getWebflowIntegrationStatus(report.brand.id);

  return (
    <div className="space-y-6">
      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
                Cycle #{report.cycle.cycle_number}
              </div>
              <Badge variant={report.report?.is_ready ? "sage" : "gold"}>
                {report.report?.is_ready ? "PDF stored" : "PDF pending"}
              </Badge>
            </div>
            <h2 className="mt-2 font-display text-3xl text-dark">
              {report.brand.brand_name} in-app visibility report
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-mid">
              Review the executive summary, prompt-level hits and misses, category performance,
              competitor gap analysis, and the content generated from this cycle.
            </p>
          </div>
          <ReportActionButtons cycleId={report.cycle.id} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6 md:p-8">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            1. Executive summary
          </div>
          <h3 className="mt-2 font-display text-2xl text-dark">What happened this cycle</h3>
          <p className="mt-4 text-sm leading-7 text-mid">{report.executiveSummary.summaryText}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-card border border-sage/12 bg-white p-4">
              <div className="text-xs uppercase tracking-[1.4px] text-sage">Visibility score</div>
              <div className="mt-2 font-display text-3xl text-dark">
                {formatRoundedValue(report.executiveSummary.visibilityScore)}
              </div>
            </div>
            <div className="rounded-card border border-sage/12 bg-white p-4">
              <div className="text-xs uppercase tracking-[1.4px] text-sage">Delta vs. prior</div>
              <div className="mt-2 font-display text-3xl text-dark">
                {formatDelta(report.executiveSummary.visibilityDelta)}
              </div>
            </div>
            <div className="rounded-card border border-sage/12 bg-white p-4">
              <div className="text-xs uppercase tracking-[1.4px] text-sage">Mention rate</div>
              <div className="mt-2 font-display text-3xl text-dark">
                {formatRoundedValue(report.executiveSummary.mentionRate, "%")}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 md:p-8">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            Key wins and misses
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-card border border-sage/12 bg-sage/5 p-4">
              <div className="text-xs uppercase tracking-[1.4px] text-sage">Top win</div>
              <p className="mt-2 text-sm leading-7 text-mid">{report.executiveSummary.topWin}</p>
            </div>
            <div className="rounded-card border border-accent/25 bg-accent/10 p-4">
              <div className="text-xs uppercase tracking-[1.4px] text-dark">Top miss</div>
              <p className="mt-2 text-sm leading-7 text-mid">{report.executiveSummary.topMiss}</p>
            </div>
            <div className="rounded-card border border-sage/12 bg-white p-4 text-sm leading-7 text-mid">
              Brand signals likely helping wins:{" "}
              {[...(siteSignals?.productNames ?? []), ...(siteSignals?.ingredients ?? [])]
                .slice(0, 6)
                .join(", ") || "Onboarding crawl signals will appear here once available."}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 md:p-8">
        <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
          2. Hits & misses analysis
        </div>
        <h3 className="mt-2 font-display text-2xl text-dark">Prompt-level performance</h3>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-mid">
          Use the filters to isolate recommendation, education, and product interaction misses by
          model. Hits usually indicate that your existing site signals are strong enough for model
          retrieval. Misses often point to missing comparison or interaction content.
        </p>
        <div className="mt-6">
          <PromptResultsTable rows={report.prompts} />
        </div>
      </Card>

      <Card className="p-6 md:p-8">
        <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
          3. Prompt category performance
        </div>
        <h3 className="mt-2 font-display text-2xl text-dark">Hit rate by category and model</h3>
        <div className="mt-6">
          <CategoryPerformanceChart data={report.categoryPerformance} />
        </div>
      </Card>

      <Card id="gap-analysis" className="p-6 md:p-8">
        <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
          4. Competitor gap analysis
        </div>
        <h3 className="mt-2 font-display text-2xl text-dark">Where competitors are filling the gap</h3>
        <div className="mt-6 space-y-4">
          {tierConfig.competitorBenchmarking ? (
            report.competitorGaps.length > 0 ? (
              report.competitorGaps.map((gap) => (
                <div key={gap.promptText} className="rounded-card border border-sage/12 bg-white p-5">
                  <div className="text-sm font-medium text-dark">{gap.promptText}</div>
                  <p className="mt-3 text-sm leading-7 text-mid">
                    Competitors mentioned: {gap.competitors.join(", ")}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-mid">Likely reason: {gap.likelyReason}</p>
                  <p className="mt-2 text-sm leading-7 text-mid">Suggested fix: {gap.suggestedFix}</p>
                </div>
              ))
            ) : (
              <div className="rounded-card border border-sage/12 bg-white p-5 text-sm leading-7 text-mid">
                No major competitor gap prompts were detected in this cycle.
              </div>
            )
          ) : (
            <div className="rounded-card border border-sage/12 bg-white p-5 text-sm leading-7 text-mid">
              Competitor gap analysis is available on Growth and Pro plans.
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 md:p-8">
        <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
          5. Generated content recommendations
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl text-dark">Ready-to-use drafts from this cycle</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-mid">
              Apply every safe content recommendation to Webflow as draft CMS changes, then review the preview before
              publishing.
            </p>
          </div>
          <CmsDeployButton
            cycleId={report.cycle.id}
            connected={webflowIntegration.connected}
            siteName={webflowIntegration.site_name}
          />
        </div>
        <div className="mt-6 space-y-4">
          {report.generatedContent.length > 0 ? (
            report.generatedContent.map((item) => (
              <div key={item.id} className="rounded-card border border-sage/12 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[1.4px] text-sage">
                      {item.content_type.replaceAll("_", " ")}
                    </div>
                    <h4 className="mt-2 text-lg font-medium text-dark">{item.title ?? "Untitled draft"}</h4>
                  </div>
                  <CopyButton value={item.body} />
                </div>
                <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-7 text-mid">
                  {item.body}
                </pre>
                {item.medical_sources.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.medical_sources.map((source) => (
                      <a
                        key={source}
                        href={source}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-pill border border-sage/15 bg-sage/5 px-3 py-1 text-xs text-sage"
                      >
                        Source
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-card border border-sage/12 bg-white p-5 text-sm leading-7 text-mid">
              {tierConfig.productInteractionContent
                ? "No generated content was stored for this cycle."
                : "No FAQ snippet or llms.txt draft was stored for this cycle."}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 md:p-8">
        <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
          6. Influencer match preview
        </div>
        <h3 className="mt-2 font-display text-2xl text-dark">What this report will feed next</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {report.influencerPreview.map((item) => (
            <div key={item.title} className="rounded-card border border-sage/12 bg-white p-5">
              <div className="text-sm font-medium text-dark">{item.title}</div>
              <p className="mt-3 text-sm leading-7 text-mid">{item.description}</p>
              <a href={item.href} className="mt-4 inline-flex text-sm font-medium text-sage">
                Open influencers tab
              </a>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
