import { Reveal } from "@/components/ui/Reveal";

const cards = [
  {
    icon: "🌐",
    title: "Generative Engine Optimization (GEO)",
    body: "AI models like ChatGPT, Claude, and Perplexity are becoming the new search. GEO is about ensuring your brand appears authentically when people ask health questions, not just traditional SEO.",
  },
  {
    icon: "🔍",
    title: "Real prompt validation",
    body: "We use real queries, the actual language people use when asking about health and supplements, not synthetic benchmarks. That means the data reflects genuine brand visibility.",
  },
  {
    icon: "🏥",
    title: "Trust as a long-term strategy",
    body: "In consumer health, accuracy and trustworthiness are not just ethical, they are competitive advantages. Brands AI models cite positively are brands people trust and buy.",
  },
];

export function TechnologySection() {
  return (
    <section id="technology" className="bg-dark px-6 py-[100px] text-white md:px-12">
      <Reveal className="mx-auto max-w-marketing">
        <div className="mb-4 text-[0.7rem] font-medium uppercase tracking-[2px] text-sage-light">
          Under the hood
        </div>
        <h2 className="mb-4 max-w-[700px] font-display text-[clamp(1.8rem,3vw,2.8rem)] leading-[1.2]">
          Built on accuracy. Grounded in trust.
        </h2>
        <p className="max-w-[520px] text-base font-light leading-[1.7] text-white/50">
          The supplement industry lives and dies by credibility. Here&apos;s why
          our approach is designed with that in mind.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.title}
              className="dark-glass-card px-8 py-8 transition-colors duration-200 hover:bg-white/10"
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px] bg-sage/15 text-lg">
                {card.icon}
              </div>
              <h3 className="mb-2.5 text-base font-medium">{card.title}</h3>
              <p className="text-sm font-light leading-[1.65] text-white/50">
                {card.body}
              </p>
            </div>
          ))}

          <div className="dark-glass-card gold-card px-8 py-8 md:col-span-2">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[rgba(200,169,110,0.15)] text-lg">
              ⚠️
            </div>
            <h3 className="mb-2.5 text-base font-medium">
              Why we avoid shortcut tactics
            </h3>
            <p className="text-sm font-light leading-[1.65] text-white/60">
              Strategies like listicle abuse and low-quality content farms may
              create short-term visibility gains, but they erode consumer trust
              and attract regulatory scrutiny, especially in the supplement
              space. SuppGo is built on sustainable, accuracy-first visibility.
              That is the only kind worth measuring.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
