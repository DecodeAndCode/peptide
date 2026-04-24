"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { INDUSTRY_OPTIONS, SUBSCRIPTION_PLANS } from "@/lib/suppgo";
import type { BrandRecord, SubscriptionTier } from "@/types";

interface SettingsPageClientProps {
  brand: BrandRecord;
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

function getInitialCompetitors(competitorUrls: string[]) {
  return [...competitorUrls, ...Array.from({ length: Math.max(0, 5 - competitorUrls.length) }, () => "")].slice(0, 5);
}

export function SettingsPageClient({ brand }: SettingsPageClientProps) {
  const [brandName, setBrandName] = useState(brand.brand_name);
  const [websiteUrl, setWebsiteUrl] = useState(brand.website_url);
  const [brandAliasesText, setBrandAliasesText] = useState((brand.brand_aliases ?? []).join(", "));
  const [industryTags, setIndustryTags] = useState<string[]>(brand.industry_tags);
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(getInitialCompetitors(brand.competitor_urls));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [currentTier, setCurrentTier] = useState<SubscriptionTier>(brand.subscription_tier);
  const [tierMessage, setTierMessage] = useState<string | null>(null);
  const [isTierPending, startTierTransition] = useTransition();
  const [confirmingTier, setConfirmingTier] = useState<SubscriptionTier | null>(null);

  function toggleIndustry(value: string) {
    setIndustryTags((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function handleSave() {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandName: brandName.trim(),
          brandAliases: parseAliasInput(brandAliasesText),
          websiteUrl: websiteUrl.trim(),
          industryTags,
          competitorUrls: competitorUrls.map((value) => value.trim()).filter(Boolean),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "Unable to save brand settings right now.");
        return;
      }

      setMessage("Brand settings saved.");
    });
  }

  function handleTierSwitch(tier: SubscriptionTier) {
    if (tier === currentTier) return;
    setConfirmingTier(tier);
  }

  function confirmTierSwitch() {
    if (!confirmingTier) return;

    setTierMessage(null);
    const tier = confirmingTier;
    setConfirmingTier(null);

    startTierTransition(async () => {
      const response = await fetch("/api/settings/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionTier: tier }),
      });

      const payload = (await response.json().catch(() => null)) as {
        subscriptionTier?: SubscriptionTier;
        error?: string;
      } | null;

      if (!response.ok) {
        setTierMessage(payload?.error ?? "Unable to update plan right now.");
        return;
      }

      setCurrentTier(payload?.subscriptionTier ?? tier);
      setTierMessage("Plan updated. Changes take effect on your next cycle.");
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 md:p-8">
        <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">Settings</div>
        <h2 className="mt-2 font-display text-3xl text-dark">Brand profile and billing</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-mid">
          Keep the brand profile current so future cycles, content drafts, and influencer matching
          stay aligned with the products and competitors you actually care about.
        </p>
      </Card>

      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
              Brand settings
            </div>
            <h3 className="mt-2 font-display text-2xl text-dark">Profile inputs used across the app</h3>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="btn-primary px-5 py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save settings"}
          </button>
        </div>

        {message ? <p className="mt-4 text-sm text-mid">{message}</p> : null}

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="brandName" className="text-sm font-medium text-dark">
              Brand name
            </label>
            <input
              id="brandName"
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
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
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
            />
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <label htmlFor="brandAliases" className="text-sm font-medium text-dark">
            Brand aliases
          </label>
          <textarea
            id="brandAliases"
            value={brandAliasesText}
            onChange={(event) => setBrandAliasesText(event.target.value)}
            rows={3}
            className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
          />
          <p className="text-xs text-mid">Comma or line-break separated. Used for mention detection.</p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="text-sm font-medium text-dark">Industry tags</div>
          <div className="flex flex-wrap gap-3">
            {INDUSTRY_OPTIONS.map((option) => {
              const selected = industryTags.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleIndustry(option.value)}
                  className={`rounded-pill border px-4 py-2 text-sm transition ${
                    selected
                      ? "border-sage bg-sage text-white"
                      : "border-sage/15 bg-white text-mid hover:border-sage/35 hover:text-dark"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="text-sm font-medium text-dark">Competitor URLs</div>
          <div className="grid gap-3">
            {competitorUrls.map((value, index) => (
              <input
                key={`${index + 1}`}
                type="url"
                value={value}
                placeholder={`https://competitor-${index + 1}.com`}
                onChange={(event) =>
                  setCompetitorUrls((current) =>
                    current.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)),
                  )
                }
                className="w-full rounded-card border border-sage/20 bg-white px-4 py-3 text-dark outline-none transition-colors duration-200 focus:border-sage"
              />
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6 md:p-8">
        <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">Billing</div>
        <h3 className="mt-2 font-display text-2xl text-dark">Subscription plan</h3>

        <div className="mt-3 flex flex-wrap gap-6 text-sm text-mid">
          <span>
            Status:{" "}
            <span className="font-medium capitalize text-dark">{brand.subscription_status}</span>
          </span>
          {brand.trial_ends_at && (
            <span>
              Trial ends:{" "}
              <span className="font-medium text-dark">
                {new Date(brand.trial_ends_at).toLocaleDateString()}
              </span>
            </span>
          )}
        </div>

        {tierMessage && (
          <p className="mt-4 text-sm text-mid">{tierMessage}</p>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isActive = currentTier === plan.tier;
            const isConfirming = confirmingTier === plan.tier;

            return (
              <div
                key={plan.tier}
                className={`rounded-card border p-5 transition ${
                  isActive
                    ? "border-sage bg-sage/5"
                    : "border-sage/15 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-lg font-medium text-dark">{plan.name}</div>
                    <div className="mt-0.5 text-sm text-mid">
                      {plan.price}
                      <span className="text-xs text-mid/60"> / mo</span>
                    </div>
                  </div>
                  {isActive && (
                    <span className="shrink-0 rounded-full bg-sage/10 px-2.5 py-1 text-xs font-medium text-sage">
                      Current
                    </span>
                  )}
                </div>

                <ul className="mt-4 space-y-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-mid">
                      <span className="mt-px text-sage">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {!isActive && (
                  <div className="mt-4">
                    {isConfirming ? (
                      <div className="space-y-2">
                        <p className="text-xs text-mid">
                          Switch to {plan.name}? Takes effect on next cycle.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={confirmTierSwitch}
                            disabled={isTierPending}
                            className="btn-primary px-3 py-1.5 text-xs disabled:opacity-60"
                          >
                            {isTierPending ? "Switching..." : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingTier(null)}
                            className="rounded-card border border-sage/20 px-3 py-1.5 text-xs text-mid transition hover:border-sage/40"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTierSwitch(plan.tier as SubscriptionTier)}
                        disabled={isTierPending}
                        className="w-full rounded-card border border-sage/20 py-2 text-xs font-medium text-dark transition hover:border-sage hover:bg-sage/5 disabled:opacity-60"
                      >
                        Switch to {plan.name}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-mid/70">
          {/* TODO: Wire to Stripe billing after MVP. */}
          Payment processing coming soon. Plan changes take effect immediately for cycle configuration.
        </p>
      </Card>
    </div>
  );
}
