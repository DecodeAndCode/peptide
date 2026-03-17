import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { SUBSCRIPTION_PLANS } from "@/lib/suppgo";

export function PricingPlans() {
  return (
    <section id="plans">
      <Reveal className="mx-auto max-w-marketing px-6 py-[100px] md:px-12">
        <div className="mb-4 text-[0.7rem] font-medium uppercase tracking-[2px] text-sage">
          Pricing
        </div>
        <h2 className="mb-4 max-w-[700px] font-display text-[clamp(1.8rem,3vw,2.8rem)] leading-[1.2] text-dark">
          Simple tiers, no surprises
        </h2>
        <p className="mb-14 max-w-[520px] text-base font-light leading-[1.7] text-mid">
          Choose based on how often you want analysis, how many models you want
          monitored, and how deep you want to go.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const content = (
              <>
                <div
                  className={
                    plan.featured
                      ? "mb-3 text-xs font-medium uppercase tracking-[1.5px] text-white/70"
                      : "mb-3 text-xs font-medium uppercase tracking-[1.5px] text-sage"
                  }
                >
                  {plan.name}
                </div>
                <div
                  className={
                    plan.featured
                      ? "mb-1 font-display text-[2.4rem] text-white"
                      : "mb-1 font-display text-[2.4rem] text-dark"
                  }
                >
                  {plan.price}
                </div>
                <div
                  className={
                    plan.featured ? "mb-6 text-sm text-white/65" : "mb-6 text-sm text-mid"
                  }
                >
                  {plan.period}
                </div>

                <p
                  className={
                    plan.featured
                      ? "mb-6 text-sm leading-6 text-white/78"
                      : "mb-6 text-sm leading-6 text-mid"
                  }
                >
                  {plan.description}
                </p>

                <ul className="mb-8 flex list-none flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={
                        plan.featured
                          ? "flex items-start gap-2.5 text-sm font-light text-white/80 before:content-['✓'] before:text-white/70"
                          : "flex items-start gap-2.5 text-sm font-light text-mid before:content-['✓'] before:text-sage"
                      }
                    >
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  href={`/signup?plan=${plan.tier}`}
                  className={
                    plan.featured
                      ? "w-full bg-white text-sage hover:bg-dark hover:text-white"
                      : "w-full"
                  }
                >
                  Get started
                </Button>
              </>
            );

            return plan.featured ? (
              <div
                key={plan.name}
                className="rounded-card border border-sage bg-sage px-9 py-9 text-white transition-transform duration-200 hover:-translate-y-1"
              >
                {content}
              </div>
            ) : (
              <Card
                key={plan.name}
                className="px-9 py-9 transition-transform duration-200 hover:-translate-y-1"
              >
                {content}
              </Card>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}
