import { Card } from "@/components/ui/Card";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <Card className="p-6 md:p-8">
        <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
          Reports
        </div>
        <h2 className="mt-2 font-display text-3xl text-dark">Report routing is in place.</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-mid">
          This route is now protected inside the dashboard shell. Completed cycle history,
          report summaries, and download actions will plug in here once Step 11 is built.
        </p>
      </Card>
    </div>
  );
}
