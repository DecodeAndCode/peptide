import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";

const steps = [
  {
    number: "01",
    title: "We run the queries",
    body: "Our system regularly sends real prompts to leading AI models, the same questions your future customers are asking about health and supplements.",
  },
  {
    number: "02",
    title: "We analyze and synthesize",
    body: "Each analysis cycle, we generate a clear, readable report showing trends, keyword patterns, and where your brand appears or does not.",
  },
  {
    number: "03",
    title: "You read, we keep watch",
    body: "When a cycle completes, you get a report. No alerts to manage, no constant monitoring. The dashboard is there when you want to explore, but it does not demand daily attention.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works">
      <Reveal className="mx-auto max-w-marketing px-6 py-[100px] md:px-12">
        <div className="mb-4 text-[0.7rem] font-medium uppercase tracking-[2px] text-sage">
          The experience
        </div>
        <h2 className="mb-4 max-w-[700px] font-display text-[clamp(1.8rem,3vw,2.8rem)] leading-[1.2] text-dark">
          You relax. We watch.
        </h2>
        <p className="mb-14 max-w-[520px] text-base font-light leading-[1.7] text-mid">
          No dashboards to obsess over. No jargon to decode. We deliver clear
          cycle reports, and you read them when they arrive.
        </p>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <Card
              key={step.number}
              className="px-8 py-8 transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <div className="mb-4 font-display text-[2.5rem] font-semibold leading-none text-sage/20">
                {step.number}
              </div>
              <h3 className="mb-2.5 text-base font-medium text-dark">{step.title}</h3>
              <p className="text-sm font-light leading-[1.65] text-mid">{step.body}</p>
            </Card>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
