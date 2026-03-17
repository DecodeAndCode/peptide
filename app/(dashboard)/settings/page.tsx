import { Card } from "@/components/ui/Card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Card className="p-6 md:p-8">
        <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
          Settings
        </div>
        <h2 className="mt-2 font-display text-3xl text-dark">
          Billing and brand controls will live here.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-mid">
          This route is part of the authenticated shell now so the later settings work can
          plug directly into it without reworking navigation or access control.
        </p>
        <div className="mt-6 rounded-card border border-sage/15 bg-sage/5 p-4 text-sm leading-6 text-mid">
          TODO: Stripe billing UI and subscription management will be added in Step 14.
        </div>
      </Card>
    </div>
  );
}
