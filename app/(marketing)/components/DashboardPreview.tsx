import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";

const features = [
  {
    icon: "📊",
    title: "YTD Trend Graph",
    body: "A living chart of your brand visibility over time, updated each analysis cycle so you can see momentum at a glance.",
  },
  {
    icon: "🔑",
    title: "Top Keywords",
    body: "Which terms are getting your brand into AI responses? We surface the most common keywords from successful query appearances.",
  },
  {
    icon: "📋",
    title: "Cycle Reports",
    body: "Each analysis cycle produces a plain-language report. Read it like a newsletter, no technical background needed.",
  },
];

export function DashboardPreview() {
  return (
    <section>
      <div className="mx-auto h-px max-w-marketing bg-sage/15" />
      <Reveal className="mx-auto max-w-marketing px-6 py-[100px] md:px-12">
        <div className="mb-4 text-[0.7rem] font-medium uppercase tracking-[2px] text-sage">
          Your dashboard
        </div>
        <h2 className="mb-4 max-w-[700px] font-display text-[clamp(1.8rem,3vw,2.8rem)] leading-[1.2] text-dark">
          When you want to look under the hood
        </h2>
        <p className="mb-14 max-w-[520px] text-base font-light leading-[1.7] text-mid">
          Your live dashboard tracks year-to-date visibility trends, shows which
          keywords are driving appearances in successful AI queries, and gives you
          a real-time feel for momentum without requiring your attention daily.
        </p>

        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="px-8 py-8 transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <div className="mb-4 font-display text-[2.5rem] font-semibold leading-none text-sage/60">
                {feature.icon}
              </div>
              <h3 className="mb-2.5 text-base font-medium text-dark">{feature.title}</h3>
              <p className="text-sm font-light leading-[1.65] text-mid">
                {feature.body}
              </p>
            </Card>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
