import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function InfluencersPage() {
  return (
    <div className="space-y-6">
      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            Influencers
          </div>
          <Badge variant="gold">Pro feature</Badge>
        </div>
        <h2 className="mt-2 font-display text-3xl text-dark">
          The route is ready for the matching module.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-mid">
          This shell page keeps navigation and entitlement framing in place now, while the
          Perplexity-grounded discovery workflow lands later in the build order.
        </p>
      </Card>
    </div>
  );
}
