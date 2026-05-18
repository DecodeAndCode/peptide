import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { SUBSCRIPTION_PLANS } from "@/lib/suppgo";

export function PricingPlans() {
  const plan = SUBSCRIPTION_PLANS[0];

  return (
    <section id="plans">
      <Reveal className="mx-auto max-w-marketing px-6 py-[100px] md:px-12">
        <div className="mb-4 text-[0.7rem] font-medium uppercase tracking-[2px] text-sage">
          Pricing
        </div>
        <h2 className="mb-4 max-w-[700px] font-display text-[clamp(1.8rem,3vw,2.8rem)] leading-[1.2] text-dark">
          Built for consumer health and supplement brands
        </h2>
        <p className="mb-14 max-w-[540px] text-base font-light leading-[1.7] text-mid">
          Start a free trial to learn how AI assistants describe your category, where you are invisible
          next to competitors, and which content moves the needle—focused on wellness shoppers, not
          technical tool specs. Pricing options will follow when we turn on billing.
        </p>

        <div className="mx-auto max-w-md">
          <div className="rounded-card border border-sage bg-sage px-9 py-9 text-white transition-transform duration-200 hover:-translate-y-1">
            <div className="mb-3 text-xs font-medium uppercase tracking-[1.5px] text-white/70">
              {plan.name}
            </div>
            <div className="mb-1 font-display text-[2.4rem] text-white">{plan.price}</div>
            <div className="mb-6 text-sm text-white/65">{plan.period}</div>
            <p className="mb-6 text-sm leading-6 text-white/78">{plan.description}</p>
            <ul className="mb-8 flex list-none flex-col gap-2">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm font-light text-white/80 before:content-['✓'] before:text-white/70"
                >
                  {feature}
                </li>
              ))}
            </ul>
            <Button href="/signup" className="w-full bg-white text-sage hover:bg-dark hover:text-white">
              Get started
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
