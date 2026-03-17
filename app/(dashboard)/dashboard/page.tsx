import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getDashboardContext } from "@/lib/brands";
import { getSubscriptionPlan } from "@/lib/suppgo";

export default async function DashboardPage() {
  const context = await getDashboardContext();

  if (!context?.brand) {
    return null;
  }

  const plan = getSubscriptionPlan(context.brand.subscription_tier);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
                Overview
              </div>
              <h2 className="mt-2 font-display text-3xl text-dark">
                Your workspace is ready for cycle data.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-mid">
                The authenticated shell, routing, and brand context are now in place. The
                visibility scorecards, charts, and report analytics arrive in the next build
                step once the cycle engine is connected.
              </p>
            </div>
            <Badge variant="gold">{plan.name} trial</Badge>
          </div>
        </Card>

        <Card className="p-6 md:p-8">
          <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
            Site readiness
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-mid">
            <p>Website: {context.brand.website_url}</p>
            <p>
              Latest crawl:{" "}
              {context.latestSiteAnalysis?.crawled_at
                ? new Date(context.latestSiteAnalysis.crawled_at).toLocaleDateString()
                : "Not yet analyzed"}
            </p>
            <p>
              Pages analyzed: {context.latestSiteAnalysis?.pages_analyzed ?? 0}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <div className="text-sm font-medium text-dark">Brand profile</div>
          <p className="mt-3 text-sm leading-6 text-mid">
            {context.brand.industry_tags.length} selected subcategories and{" "}
            {context.brand.competitor_urls.length} tracked competitors are available for future
            benchmarking.
          </p>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-medium text-dark">Crawler output</div>
          <p className="mt-3 text-sm leading-6 text-mid">
            {context.latestSiteAnalysis?.missing_content_gaps.length ?? 0} content gaps were
            identified from the onboarding scan.
          </p>
        </Card>
        <Card className="p-6">
          <div className="text-sm font-medium text-dark">Next build step</div>
          <p className="mt-3 text-sm leading-6 text-mid">
            Wire the LLM query engine and prompt library into this shell to populate live
            dashboard metrics.
          </p>
        </Card>
      </div>
    </div>
  );
}
