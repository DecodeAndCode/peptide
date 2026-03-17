import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/BarChart";

const metrics = [
  { label: "AI Search Presence", value: "84%" },
  { label: "Trust Signal Score", value: "71%", delay: "0.2s" },
  { label: "Keyword Accuracy", value: "92%", delay: "0.4s" },
];

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden px-6 pb-20 pt-[120px] md:px-12 md:pb-20 md:pt-[120px]"
    >
      <div className="pointer-events-none absolute right-[-100px] top-[-100px] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(122,158,135,0.12)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-[-50px] left-[20%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(200,169,110,0.08)_0%,transparent_70%)]" />

      <div className="mx-auto grid min-h-[calc(100vh-200px)] max-w-marketing items-center gap-10 md:grid-cols-2 md:gap-20">
        <div>
          <div className="mb-5 text-xs font-medium uppercase tracking-[2px] text-sage">
            Every Search. Every Answer. Your Brand.
          </div>
          <h1 className="mb-6 font-display text-[clamp(2.4rem,4vw,3.8rem)] font-semibold leading-[1.15] text-dark">
            Your supplement brand, <em className="font-normal italic text-sage">seen</em>{" "}
            by the right people
          </h1>
          <p className="mb-9 max-w-[460px] text-[1.05rem] font-light leading-[1.7] text-mid">
            SuppGo monitors how AI models respond to health queries so you always
            know where your brand stands, without having to think about it 99% of
            the time.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button href="/signup">Start free trial</Button>
            <Button href="/login" variant="outline">
              Sign in
            </Button>
          </div>
        </div>

        <div className="relative hidden md:block">
          <div className="relative h-[380px]">
            <Card className="absolute inset-x-0 top-0 border-sage/10 px-7 py-7">
              <div data-float style={{ animation: "float 4s ease-in-out infinite" }}>
                <div className="mb-2 text-[0.7rem] font-medium uppercase tracking-[1.5px] text-sage-light">
                  Latest Analysis Cycle
                </div>
                <div className="mb-4 font-display text-base text-dark">
                  Brand Visibility Report
                </div>
                <div className="flex flex-col gap-2.5">
                  {metrics.map((metric) => (
                    <BarChart key={metric.label} {...metric} />
                  ))}
                </div>
                <div className="mt-5">
                  <div className="inline-flex items-center gap-1.5 rounded-pill bg-sage/10 px-3.5 py-1.5 text-xs font-medium text-sage">
                    <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                    Updated 2 hours ago
                  </div>
                </div>
              </div>
            </Card>

            <Card className="absolute bottom-5 right-[-20px] w-[200px] px-7 py-6">
              <div data-float style={{ animation: "float 4s ease-in-out infinite 1s" }}>
                <div className="font-display text-[1.8rem] text-dark">↑ 12%</div>
                <div className="mt-1 text-[0.72rem] text-mid">
                  Visibility vs last cycle
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
