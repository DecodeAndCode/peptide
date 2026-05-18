import { notFound } from "next/navigation";
import { CategoryPerformanceChart } from "@/components/dashboard/CategoryPerformanceChart";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { GitHubDeployButton } from "@/components/dashboard/GitHubDeployButton";
import { PromptResultsTable } from "@/components/dashboard/PromptResultsTable";
import { ReportActionButtons } from "@/components/dashboard/ReportActionButtons";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InfoHint } from "@/components/ui/InfoHint";
import { getCycleReportData } from "@/lib/dashboard";
import { formatRoundedValue, formatSignedRoundedValue } from "@/lib/formatting";
import { getPublishTargetStatus } from "@/lib/integrations";
import { getGeneratedContentDisplay } from "@/lib/suppgo";

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
  const publishTarget = await getPublishTargetStatus(report.brand.id);
  const detectedSignals = Array.from(
    new Set([...(siteSignals?.productNames ?? []), ...(siteSignals?.ingredients ?? [])].map((item) => item.trim())),
  )
    .filter(Boolean)
    .filter((item) => !/^shop\b/i.test(item))
    .filter((item) => !/testing entity coverage/i.test(item))
    .slice(0, 6);

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

      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">1. Generated content</div>
            <div className="mt-2 flex min-w-0 flex-nowrap items-start gap-1.5">
              <h3 className="min-w-0 font-display text-2xl text-dark leading-snug">
                Cycle-linked drafts ready to publish
              </h3>
              <InfoHint triggerLabel="What this section contains">
                Drafts from this cycle only: stack &amp; combination guides (missed “can I take this with that?”
                prompts), FAQ snippets (other missed prompts), and a brand context file when generated—each
                labeled by type so you know what gap it targets.
              </InfoHint>
            </div>
          </div>
        </div>
        <div className="mt-6">
          {report.generatedContent.length > 0 ? (
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
              {report.generatedContent.map((item) => {
                const draft = getGeneratedContentDisplay(item.content_type);
                return (
                <div
                  key={item.id}
                  className="flex h-[460px] min-w-[320px] max-w-[360px] shrink-0 snap-start flex-col rounded-card border border-sage/12 bg-white p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-nowrap items-center gap-0.5">
                        <span
                          className="min-w-0 truncate text-xs uppercase tracking-[1.4px] text-sage"
                          title={draft.label}
                        >
                          {draft.label}
                        </span>
                        <InfoHint triggerLabel={`What “${draft.label}” means`}>{draft.rationale}</InfoHint>
                      </div>
                      <h4 className="mt-2 text-lg font-medium text-dark">{item.title ?? "Untitled draft"}</h4>
                    </div>
                    {publishTarget.target === "github" && publishTarget.connected ? (
                      <GitHubDeployButton contentId={item.id} className="" />
                    ) : publishTarget.target === "cms" && publishTarget.connected ? (
                      <CopyButton value={item.body} label="Push to CMS" />
                    ) : (
                      <CopyButton value={item.body} label="Copy draft" />
                    )}
                  </div>
                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-mid">
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
                </div>
              );
              })}
            </div>
          ) : (
            <div className="rounded-card border border-sage/12 bg-white p-5 text-sm leading-7 text-mid">
              No generated content was stored for this cycle.
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6 md:p-8">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            2. Executive summary
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
              <div className="flex min-w-0 flex-nowrap items-center gap-0.5">
                <div className="min-w-0 truncate text-xs uppercase tracking-[1.4px] text-sage">Top win</div>
                <InfoHint triggerLabel="What top win means">
                  The prompt where your brand ranked highest across all models this cycle.
                </InfoHint>
              </div>
              <p className="mt-2 text-sm leading-7 text-mid">{report.executiveSummary.topWin}</p>
            </div>
            <div className="rounded-card border border-accent/25 bg-accent/10 p-4">
              <div className="flex min-w-0 flex-nowrap items-center gap-0.5">
                <div className="min-w-0 truncate text-xs uppercase tracking-[1.4px] text-dark">Top miss</div>
                <InfoHint triggerLabel="What top miss means">
                  A different prompt where competitors appeared but your brand did not — your clearest content gap.
                </InfoHint>
              </div>
              <p className="mt-2 text-sm leading-7 text-mid">{report.executiveSummary.topMiss}</p>
            </div>
            <div className="rounded-card border border-sage/12 bg-white p-4 text-sm leading-7 text-mid">
              <div className="text-xs uppercase tracking-[1.4px] text-sage">Detected brand signals from site crawl</div>
              {detectedSignals.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {detectedSignals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2">Onboarding crawl signals will appear here once available.</p>
              )}
              <p className="mt-2 text-xs text-mid">
                Signals are extracted from headings, schema, and page text and may include noise.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <details className="group rounded-card border border-sage/15 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-dark">
          <span>Advanced analysis</span>
          <span className="text-mid transition-transform duration-200 group-open:rotate-180" aria-hidden="true">
            ▼
          </span>
        </summary>
        <div className="space-y-6 border-t border-sage/10 px-5 pb-5 pt-4">
          <Card className="p-6 md:p-8">
            <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
              3. Hits & misses analysis
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
              4. Prompt category performance
            </div>
            <h3 className="mt-2 font-display text-2xl text-dark">Hit rate by category and model</h3>
            <div className="mt-6">
              <CategoryPerformanceChart data={report.categoryPerformance} />
            </div>
          </Card>

          <Card id="gap-analysis" className="p-6 md:p-8">
            <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
              5. Competitor gap analysis
            </div>
            <h3 className="mt-2 font-display text-2xl text-dark">Where competitors are filling the gap</h3>
            <div className="mt-6 space-y-4">
              {report.competitorGaps.length > 0 ? (
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
      </details>
    </div>
  );
}
