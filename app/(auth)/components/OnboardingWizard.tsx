"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { INDUSTRY_OPTIONS, DEFAULT_TRIAL_SUBSCRIPTION_TIER, SUBSCRIPTION_PLANS } from "@/lib/suppgo";
import type { BrandRecord, SiteAnalysisRecord } from "@/types";

type WizardStep = 1 | 2 | 3 | 4;

interface OnboardingWizardProps {
  initialBrand: BrandRecord | null;
  initialAnalysis: SiteAnalysisRecord | null;
}

interface ProfilePayload {
  brandName: string;
  brandAliases: string[];
  websiteUrl: string;
  industryTags: string[];
  competitorUrls: string[];
}

interface AnalysisApiResponse {
  summary: {
    pagesAnalyzed: number;
    topicCount: number;
    contentGapCount: number;
  };
  analysis: SiteAnalysisRecord;
}

const analysisMessages = [
  "Fetching the homepage and high-intent internal pages.",
  "Checking for llms.txt, schema markup, and crawlability issues.",
  "Extracting product, ingredient, and FAQ content signals.",
  "Identifying missing content gaps against your selected subcategories.",
];

function getInitialCompetitors(brand: Pick<BrandRecord, "competitor_urls"> | null) {
  const existing = brand?.competitor_urls ?? [];
  return [...existing, ...Array.from({ length: Math.max(0, 5 - existing.length) }, () => "")].slice(0, 5);
}

function parseAliasInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

function mergeAliases(existing: string[], suggested: string[]) {
  return Array.from(new Set([...existing, ...suggested].map((value) => value.trim()).filter(Boolean))).slice(0, 12);
}

export function OnboardingWizard({ initialBrand, initialAnalysis }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [profile, setProfile] = useState<ProfilePayload>({
    brandName: initialBrand?.brand_name ?? "",
    brandAliases: initialBrand?.brand_aliases ?? [],
    websiteUrl: initialBrand?.website_url ?? "",
    industryTags: initialBrand?.industry_tags ?? [],
    competitorUrls: getInitialCompetitors(initialBrand),
  });
  const [brandAliasesText, setBrandAliasesText] = useState((initialBrand?.brand_aliases ?? []).join("\n"));
  const [savedProfile, setSavedProfile] = useState<ProfilePayload | null>(
    initialBrand
      ? {
          brandName: initialBrand.brand_name,
          brandAliases: initialBrand.brand_aliases ?? [],
          websiteUrl: initialBrand.website_url,
          industryTags: initialBrand.industry_tags,
          competitorUrls: getInitialCompetitors(initialBrand),
        }
      : null,
  );
  const [analysis, setAnalysis] = useState<SiteAnalysisRecord | null>(initialAnalysis);
  const [analysisMessageIndex, setAnalysisMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const trialOffering = SUBSCRIPTION_PLANS[0];

  useEffect(() => {
    if (!runningAnalysis) {
      return;
    }

    const interval = window.setInterval(() => {
      setAnalysisMessageIndex((current) => (current + 1) % analysisMessages.length);
    }, 1400);

    return () => {
      window.clearInterval(interval);
    };
  }, [runningAnalysis]);

  const hasProfileChanges = useMemo(() => {
    if (!savedProfile) {
      return true;
    }

    return JSON.stringify(savedProfile) !== JSON.stringify({ ...profile, brandAliases: parseAliasInput(brandAliasesText) });
  }, [brandAliasesText, profile, savedProfile]);

  async function saveProfile() {
    setSavingProfile(true);
    setError(null);

    const competitorUrls = profile.competitorUrls.map((value) => value.trim()).filter(Boolean);
    const brandAliases = parseAliasInput(brandAliasesText);

    const response = await fetch("/api/onboarding/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        brandName: profile.brandName.trim(),
        brandAliases,
        websiteUrl: profile.websiteUrl.trim(),
        industryTags: profile.industryTags,
        competitorUrls,
      }),
    });

    const result = (await response.json().catch(() => null)) as { error?: string } | null;

    setSavingProfile(false);

    if (!response.ok) {
      setError(result?.error ?? "Unable to save your brand details.");
      return false;
    }

    const persistedProfile: ProfilePayload = {
      ...profile,
      brandAliases,
      competitorUrls: getInitialCompetitors({ competitor_urls: competitorUrls }),
    };

    setProfile(persistedProfile);
    setSavedProfile(persistedProfile);
    setStep(2);
    return true;
  }

  async function runAnalysis() {
    setRunningAnalysis(true);
    setAnalysisMessageIndex(0);
    setError(null);

    const response = await fetch("/api/onboarding/analyze-site", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        brandName: profile.brandName.trim(),
        websiteUrl: profile.websiteUrl.trim(),
        industryTags: profile.industryTags,
      }),
    });

    const result = (await response.json().catch(() => null)) as
      | ({ error?: string } & Partial<AnalysisApiResponse>)
      | null;

    setRunningAnalysis(false);

    if (!response.ok || !result?.analysis) {
      setError(result?.error ?? "Unable to analyze the site right now.");
      return;
    }

    const analysisRecord = result.analysis;
    const mergedAliases = mergeAliases(
      parseAliasInput(brandAliasesText),
      analysisRecord.content_signals?.brandAliases ?? [],
    );

    setAnalysis(analysisRecord);
    setProfile((current) => ({
      ...current,
      brandAliases: mergedAliases,
    }));
    setBrandAliasesText(mergedAliases.join("\n"));
  }

  async function startTrial() {
    setStartingTrial(true);
    setError(null);

    const response = await fetch("/api/onboarding/subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscriptionTier: DEFAULT_TRIAL_SUBSCRIPTION_TIER,
      }),
    });

    const result = (await response.json().catch(() => null)) as
      | { error?: string; redirectTo?: string }
      | null;

    setStartingTrial(false);

    if (!response.ok || !result?.redirectTo) {
      setError(result?.error ?? "Unable to start the free trial.");
      return;
    }

    // Save the destination and move to the optional site-integration step
    setPendingRedirect(result.redirectTo);
    setStep(4);
  }

  return (
    <div className="mx-auto max-w-6xl py-8 md:py-16">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-3 text-xs font-medium uppercase tracking-[2px] text-sage">
            Brand onboarding
          </div>
          <h1 className="font-display text-[clamp(2.4rem,4vw,3.7rem)] leading-[1.08] text-dark">
            Set the brand context that will shape every future cycle.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-mid">
            We start with brand details, analyze the public site for crawlability and
            content signals, then start your trial on the full product surface (every model and feature).
          </p>
        </div>

        <div className="flex gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-medium ${
                item === step
                  ? "border-sage bg-sage text-white"
                  : item < step
                    ? "border-sage/30 bg-sage/10 text-sage"
                    : "border-sage/15 bg-white text-mid"
              }`}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-card border border-accent/30 bg-accent/10 px-5 py-4 text-sm text-dark">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Card className="p-6 md:p-8">
            {step === 1 ? (
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[1.8px] text-sage">
                    Step 1
                  </div>
                  <h2 className="mt-2 font-display text-3xl text-dark">Brand setup</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-mid">
                    Enter the profile we will benchmark. Competitors are optional, but
                    adding them gives future reports a much stronger point of comparison.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="brandName" className="text-sm font-medium text-dark">
                      Brand name
                    </label>
                    <input
                      id="brandName"
                      value={profile.brandName}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, brandName: event.target.value }))
                      }
                      className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="websiteUrl" className="text-sm font-medium text-dark">
                      Website URL
                    </label>
                    <input
                      id="websiteUrl"
                      type="url"
                      value={profile.websiteUrl}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, websiteUrl: event.target.value }))
                      }
                      className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="brandAliases" className="text-sm font-medium text-dark">
                    Also known as
                  </label>
                  <textarea
                    id="brandAliases"
                    rows={4}
                    value={brandAliasesText}
                    onChange={(event) => setBrandAliasesText(event.target.value)}
                    placeholder={"Athletic Greens\nAG1 Daily"}
                    className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
                  />
                  <p className="text-sm leading-6 text-mid">
                    Optional former names, hero product names, or common abbreviations that models may use instead
                    of your primary brand name.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium text-dark">Industry subcategories</div>
                  <div className="flex flex-wrap gap-3">
                    {INDUSTRY_OPTIONS.map((option) => {
                      const isSelected = profile.industryTags.includes(option.value);

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setProfile((current) => ({
                              ...current,
                              industryTags: isSelected
                                ? current.industryTags.filter((value) => value !== option.value)
                                : [...current.industryTags, option.value],
                            }))
                          }
                          className={`rounded-pill border px-4 py-2 text-sm transition-colors duration-200 ${
                            isSelected
                              ? "border-sage bg-sage text-white"
                              : "border-sage/20 bg-white text-mid hover:border-sage/35 hover:text-dark"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-dark">Competitor URLs</div>
                    <p className="mt-1 text-sm leading-6 text-mid">
                      Helps us benchmark your visibility against the brands most likely to
                      appear beside you in model answers.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    {profile.competitorUrls.map((value, index) => (
                      <input
                        key={`competitor-${index + 1}`}
                        type="url"
                        placeholder={`https://competitor-${index + 1}.com`}
                        value={value}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            competitorUrls: current.competitorUrls.map((entry, entryIndex) =>
                              entryIndex === index ? event.target.value : entry,
                            ),
                          }))
                        }
                        className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    disabled={savingProfile}
                    onClick={() => void saveProfile()}
                    className="btn-primary min-w-[180px]"
                  >
                    {savingProfile ? "Saving..." : "Continue to analysis"}
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[1.8px] text-sage">
                    Step 2
                  </div>
                  <h2 className="mt-2 font-display text-3xl text-dark">Site analysis</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-mid">
                    We crawl the homepage plus the most relevant internal pages, look for
                    llms.txt and schema signals, and flag content coverage gaps against the
                    categories you selected.
                  </p>
                </div>

                <div className="rounded-card border border-sage/15 bg-sage/5 p-5">
                  <div className="text-sm font-medium text-dark">{profile.websiteUrl}</div>
                  <div className="mt-2 text-sm leading-6 text-mid">
                    Selected categories: {profile.industryTags.length}
                  </div>
                </div>

                {runningAnalysis ? (
                  <div className="rounded-card border border-sage/20 bg-white p-6">
                    <div className="mb-4 h-2 overflow-hidden rounded-full bg-sage/10">
                      <div className="h-full w-2/3 animate-pulse rounded-full bg-sage" />
                    </div>
                    <div className="text-sm font-medium text-dark">
                      {analysisMessages[analysisMessageIndex]}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-mid">
                      This usually completes in a few seconds, depending on site size and
                      crawlability.
                    </p>
                  </div>
                ) : null}

                {analysis ? (
                  <div className="space-y-4 rounded-card border border-sage/15 bg-white p-6">
                    <div>
                      <div className="text-sm font-medium uppercase tracking-[1.2px] text-sage">
                        Analysis summary
                      </div>
                      <p className="mt-2 text-base leading-7 text-dark">
                        We found {analysis.pages_analyzed ?? 0} pages,{" "}
                        {analysis.content_signals?.topicKeywords.length ?? 0} health topics,
                        and {analysis.missing_content_gaps.length} content gaps. Here is what
                        we will optimize for first.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-card border border-sage/12 bg-sage/5 p-4">
                        <div className="text-sm font-medium text-dark">Suggested aliases</div>
                        <p className="mt-2 text-sm leading-6 text-mid">
                          {(analysis.content_signals?.brandAliases ?? []).join(", ") ||
                            "No alternate naming signals were detected on the site."}
                        </p>
                      </div>
                      <div className="rounded-card border border-sage/12 bg-sage/5 p-4">
                        <div className="text-sm font-medium text-dark">Product signals</div>
                        <p className="mt-2 text-sm leading-6 text-mid">
                          {(analysis.content_signals?.productNames ?? []).slice(0, 3).join(", ") ||
                            "No clear product naming signals found yet."}
                        </p>
                      </div>
                      <div className="rounded-card border border-sage/12 bg-sage/5 p-4">
                        <div className="text-sm font-medium text-dark">Content gaps</div>
                        <p className="mt-2 text-sm leading-6 text-mid">
                          {analysis.missing_content_gaps.slice(0, 3).join(", ") ||
                            "Coverage looks broad across the chosen subcategories."}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-card border border-sage/12 bg-cream p-4">
                      <div className="text-sm font-medium text-dark">Recommendations</div>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-mid">
                        {analysis.recommendations.map((recommendation) => (
                          <li key={recommendation}>{recommendation}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-outline min-w-[150px]"
                  >
                    Back
                  </button>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={runningAnalysis || hasProfileChanges}
                      onClick={() => void runAnalysis()}
                      className="btn-outline min-w-[170px] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {analysis ? "Re-run analysis" : "Run analysis"}
                    </button>
                    <button
                      type="button"
                      disabled={!analysis}
                      onClick={() => setStep(3)}
                      className="btn-primary min-w-[180px] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continue to trial
                    </button>
                  </div>
                </div>

                {hasProfileChanges ? (
                  <p className="text-sm leading-6 text-mid">
                    Save any Step 1 changes before running the site analysis again.
                  </p>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[1.8px] text-sage">
                    Step 3
                  </div>
                  <h2 className="mt-2 font-display text-3xl text-dark">
                    Start your free trial
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-mid">
                    Every trial includes the same visibility, gap, and content workflow—focused on how
                    AI answers wellness and supplement shoppers, not on picking a product tier.
                  </p>
                </div>

                <div className="rounded-card border border-sage bg-sage p-6 text-white md:p-8">
                  <div className="text-xs font-medium uppercase tracking-[1.5px] text-white/70">
                    {trialOffering.name}
                  </div>
                  <div className="mt-2 font-display text-3xl text-white">{trialOffering.price}</div>
                  <p className="mt-1 text-sm text-white/70">{trialOffering.period}</p>
                  <p className="mt-4 text-sm leading-6 text-white/85">{trialOffering.description}</p>
                  <ul className="mt-5 flex list-none flex-col gap-2 text-sm font-light text-white/85">
                    {trialOffering.features.map((feature) => (
                      <li key={feature} className="flex gap-2 before:content-['✓'] before:text-white/70">
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn-outline min-w-[150px]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void startTrial()}
                    disabled={startingTrial}
                    className="btn-primary min-w-[220px]"
                  >
                    {startingTrial ? "Starting trial..." : "Continue to site integration"}
                  </button>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[1.8px] text-sage">
                    Step 4 — Optional
                  </div>
                  <h2 className="mt-2 font-display text-3xl text-dark">
                    Connect your website
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-mid">
                    SuppGo can push generated content directly to your site via GitHub Pull Request
                    — no copy-paste required. You can connect now or do this later from Settings.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <a
                    href="/api/integrations/github/authorize?from=onboarding"
                    className="flex flex-col gap-3 rounded-card border border-sage/20 bg-white p-5 text-left transition hover:border-sage hover:bg-sage/5"
                  >
                    <div className="text-2xl">⬡</div>
                    <div className="font-medium text-dark">GitHub</div>
                    <p className="text-sm leading-6 text-mid">
                      Best for Next.js, Gatsby, or any code-based site. SuppGo opens a PR with new
                      markdown files after each cycle.
                    </p>
                    <span className="mt-auto inline-block rounded-pill bg-sage/10 px-3 py-1 text-xs font-medium text-sage">
                      Connect GitHub →
                    </span>
                  </a>

                  <a
                    href="/api/integrations/webflow/authorize?from=onboarding"
                    className="flex flex-col gap-3 rounded-card border border-sage/20 bg-white p-5 text-left transition hover:border-sage hover:bg-sage/5"
                  >
                    <div className="text-2xl">◈</div>
                    <div className="font-medium text-dark">Webflow CMS</div>
                    <p className="text-sm leading-6 text-mid">
                      Best for marketing-owned sites. SuppGo creates draft CMS updates from each
                      cycle so your team can preview before publishing.
                    </p>
                    <span className="mt-auto inline-block rounded-pill bg-sage/10 px-3 py-1 text-xs font-medium text-sage">
                      Connect Webflow →
                    </span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      if (pendingRedirect) {
                        router.push(pendingRedirect);
                        router.refresh();
                      }
                    }}
                    className="flex flex-col gap-3 rounded-card border border-sage/10 bg-white/60 p-5 text-left transition hover:border-sage/30 hover:bg-white"
                  >
                    <div className="text-2xl">→</div>
                    <div className="font-medium text-dark">Skip for now</div>
                    <p className="text-sm leading-6 text-mid">
                      Content will appear in your dashboard for manual review and copy. You can
                      connect a site integration at any time from Settings.
                    </p>
                    <span className="mt-auto inline-block rounded-pill bg-sage/10 px-3 py-1 text-xs font-medium text-sage">
                      Go to dashboard →
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="text-xs font-medium uppercase tracking-[1.8px] text-sage">
              What happens next
            </div>
            <div className="mt-4 space-y-4 text-sm leading-6 text-mid">
              <p>Step 1 creates or updates the single brand record tied to your user.</p>
              <p>Step 2 stores a site analysis snapshot that future cycles can build from.</p>
              <p>Step 3 starts your trial with the full product (all models and features).</p>
              <p>Step 4 optionally connects GitHub or Webflow so content flows directly into your site.</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-xs font-medium uppercase tracking-[1.8px] text-sage">
              Current selection
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-mid">
              <div>
                <div className="font-medium text-dark">Brand</div>
                <div>{profile.brandName || "Not set yet"}</div>
              </div>
              <div>
                <div className="font-medium text-dark">Website</div>
                <div>{profile.websiteUrl || "Not set yet"}</div>
              </div>
              <div>
                <div className="font-medium text-dark">Aliases</div>
                <div>{parseAliasInput(brandAliasesText).join(", ") || "None added yet"}</div>
              </div>
              <div>
                <div className="font-medium text-dark">Access</div>
                <div>{trialOffering.name} — full stack</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
