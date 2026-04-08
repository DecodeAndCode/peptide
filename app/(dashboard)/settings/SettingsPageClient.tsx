"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { INDUSTRY_OPTIONS } from "@/lib/suppgo";
import type { BrandRecord } from "@/types";

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
        <h3 className="mt-2 font-display text-2xl text-dark">Subscription placeholder</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-card border border-sage/12 bg-white p-4">
            <div className="text-xs uppercase tracking-[1.4px] text-sage">Current tier</div>
            <div className="mt-2 text-lg font-medium capitalize text-dark">{brand.subscription_tier}</div>
          </div>
          <div className="rounded-card border border-sage/12 bg-white p-4">
            <div className="text-xs uppercase tracking-[1.4px] text-sage">Status</div>
            <div className="mt-2 text-lg font-medium capitalize text-dark">{brand.subscription_status}</div>
          </div>
          <div className="rounded-card border border-sage/12 bg-white p-4">
            <div className="text-xs uppercase tracking-[1.4px] text-sage">Trial ends</div>
            <div className="mt-2 text-lg font-medium text-dark">
              {brand.trial_ends_at ? new Date(brand.trial_ends_at).toLocaleDateString() : "Not set"}
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-mid">
          Billing management is intentionally placeholder-only in MVP so the tier source of truth
          remains Section 11 and the `brands.subscription_tier` field.
        </p>
        {/* TODO: Stripe billing portal and subscription management live here after MVP. */}
      </Card>
    </div>
  );
}
