import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ReportActionButtons } from "@/components/dashboard/ReportActionButtons";
import { formatRoundedValue, formatSignedRoundedValue } from "@/lib/formatting";
import { getReportsList } from "@/lib/dashboard";

function formatDelta(value: number | null) {
  if (value === null) {
    return "Baseline";
  }

  return formatSignedRoundedValue(value);
}

export default async function ReportsPage() {
  const reports = await getReportsList();

  return (
    <div className="space-y-6">
      <Card className="p-6 md:p-8">
        <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
          Reports
        </div>
        <h2 className="mt-2 font-display text-3xl text-dark">Cycle history and PDF delivery</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-mid">
          Review completed cycles, open each in-app report, and download or re-email a signed PDF
          report from private Supabase Storage.
        </p>
      </Card>

      {reports && reports.length > 0 ? (
        reports.map(({ cycle, delta, report }) => (
          <Card key={cycle.id} className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
                    Cycle #{cycle.cycle_number}
                  </div>
                  <Badge variant={report?.is_ready ? "sage" : "gold"}>
                    {report?.is_ready ? "PDF ready" : "Generating on demand"}
                  </Badge>
                </div>
                <h3 className="mt-2 font-display text-2xl text-dark">
                  Completed{" "}
                  {new Date(cycle.completed_at ?? cycle.created_at).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-card border border-sage/12 bg-white p-4">
                    <div className="text-xs uppercase tracking-[1.4px] text-sage">Visibility score</div>
                    <div className="mt-2 font-display text-3xl text-dark">
                      {formatRoundedValue(cycle.visibility_score ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-card border border-sage/12 bg-white p-4">
                    <div className="text-xs uppercase tracking-[1.4px] text-sage">Delta vs. prior</div>
                    <div className="mt-2 font-display text-3xl text-dark">{formatDelta(delta)}</div>
                  </div>
                  <div className="rounded-card border border-sage/12 bg-white p-4">
                    <div className="text-xs uppercase tracking-[1.4px] text-sage">Prompt executions</div>
                    <div className="mt-2 font-display text-3xl text-dark">{cycle.total_prompts ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <a href={`/reports/${cycle.id}`} className="btn-outline px-5 py-2.5">
                  View report
                </a>
                <ReportActionButtons cycleId={cycle.id} />
              </div>
            </div>
          </Card>
        ))
      ) : (
        <Card className="p-6 md:p-8">
          <p className="text-sm leading-7 text-mid">
            Completed cycles will appear here after the first analysis run finishes.
          </p>
        </Card>
      )}
    </div>
  );
}
