"use client";

import { useState, useTransition, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { INDUSTRY_OPTIONS, SUBSCRIPTION_PLANS } from "@/lib/suppgo";
import type { BrandRecord, GitHubIntegrationStatus } from "@/types";

interface SettingsPageClientProps {
  brand: BrandRecord;
  githubIntegration: GitHubIntegrationStatus;
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

export function SettingsPageClient({ brand, githubIntegration }: SettingsPageClientProps) {
  const [brandName, setBrandName] = useState(brand.brand_name);
  const [websiteUrl, setWebsiteUrl] = useState(brand.website_url);
  const [brandAliasesText, setBrandAliasesText] = useState((brand.brand_aliases ?? []).join(", "));
  const [industryTags, setIndustryTags] = useState<string[]>(brand.industry_tags);
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(getInitialCompetitors(brand.competitor_urls));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // GitHub integration state
  const [github, setGithub] = useState<GitHubIntegrationStatus>(githubIntegration);
  const [githubRepo, setGithubRepo] = useState(githubIntegration.repo_full_name ?? "");
  const [githubDir, setGithubDir] = useState(githubIntegration.content_dir ?? "");
  const [githubMessage, setGithubMessage] = useState<string | null>(null);
  const [isGithubPending, startGithubTransition] = useTransition();
  const [repos, setRepos] = useState<{ full_name: string; name: string; private: boolean }[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Show success message if redirected back from GitHub OAuth
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      setGithubMessage("GitHub connected successfully. Select a repository below.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("error")?.startsWith("github_")) {
      setGithubMessage("GitHub connection failed. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function loadRepos() {
    setLoadingRepos(true);
    setGithubMessage(null);
    const res = await fetch("/api/integrations/github/repos");
    const data = (await res.json().catch(() => null)) as {
      repos?: { full_name: string; name: string; private: boolean }[];
      error?: string;
    } | null;
    setLoadingRepos(false);
    if (!res.ok || !data?.repos) {
      setGithubMessage(data?.error ?? "Failed to load repositories.");
      return;
    }
    setRepos(data.repos);
  }

  function handleSaveGithubConfig() {
    if (!githubRepo.trim()) {
      setGithubMessage("Please select or enter a repository.");
      return;
    }
    setGithubMessage(null);
    startGithubTransition(async () => {
      const res = await fetch("/api/integrations/github/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_full_name: githubRepo.trim(), content_dir: githubDir.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setGithubMessage(data?.error ?? "Failed to save configuration.");
        return;
      }
      setGithub((prev) => ({ ...prev, repo_full_name: githubRepo.trim(), content_dir: githubDir.trim() }));
      setGithubMessage("Repository configuration saved.");
    });
  }

  function handleDisconnectGithub() {
    setGithubMessage(null);
    setConfirmDisconnect(false);
    startGithubTransition(async () => {
      const res = await fetch("/api/integrations/github/disconnect", { method: "DELETE" });
      if (!res.ok) {
        setGithubMessage("Failed to disconnect GitHub.");
        return;
      }
      setGithub({ connected: false, repo_full_name: null, content_dir: null, status: "disconnected" });
      setGithubRepo("");
      setGithubDir("");
      setRepos([]);
      setGithubMessage(null);
    });
  }

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

        <div className="mt-5 rounded-card border border-sage/15 bg-sage/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-lg font-medium text-dark">{SUBSCRIPTION_PLANS[0].name}</div>
              <p className="mt-1 text-sm text-mid">{SUBSCRIPTION_PLANS[0].description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-sage/10 px-2.5 py-1 text-xs font-medium text-sage">
              Full access
            </span>
          </div>
          <ul className="mt-4 space-y-1.5">
            {SUBSCRIPTION_PLANS[0].features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-xs text-mid">
                <span className="mt-px text-sage">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-xs text-mid/70">
          Tier selection is paused during early access—every account runs the full stack. Payment
          processing and optional plans will return when billing is ready.
        </p>
      </Card>

      <Card className="p-6 md:p-8">
        <div className="text-xs font-medium uppercase tracking-[1.6px] text-sage">
          Connected integrations
        </div>
        <h3 className="mt-2 font-display text-2xl text-dark">Site integration</h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-mid">
          Connect GitHub to have SuppGo automatically open a Pull Request with generated content
          after each cycle. No copy-paste required.
        </p>

        {githubMessage ? (
          <p className="mt-4 text-sm text-mid">{githubMessage}</p>
        ) : null}

        <div className="mt-6 rounded-card border border-sage/15 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-card border border-sage/20 bg-sage/5 text-sm font-bold text-dark">
                GH
              </div>
              <div>
                <div className="font-medium text-dark">GitHub</div>
                <div className="mt-0.5 text-xs text-mid">
                  {github.connected
                    ? github.repo_full_name
                      ? `Connected — ${github.repo_full_name}`
                      : "Connected — no repository selected"
                    : "Not connected"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {github.connected ? (
                <>
                  <span className="inline-block rounded-full bg-sage/10 px-2.5 py-1 text-xs font-medium text-sage">
                    Active
                  </span>
                  {confirmDisconnect ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-mid">Disconnect?</span>
                      <button
                        type="button"
                        onClick={handleDisconnectGithub}
                        disabled={isGithubPending}
                        className="rounded-card border border-accent/30 px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent/10 disabled:opacity-60"
                      >
                        {isGithubPending ? "..." : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDisconnect(false)}
                        className="rounded-card border border-sage/20 px-3 py-1 text-xs text-mid transition hover:border-sage/40"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDisconnect(true)}
                      className="rounded-card border border-sage/20 px-3 py-1 text-xs text-mid transition hover:border-sage/40"
                    >
                      Disconnect
                    </button>
                  )}
                </>
              ) : (
                <a
                  href="/api/integrations/github/authorize?from=settings"
                  className="btn-primary px-4 py-2 text-sm"
                >
                  Connect GitHub
                </a>
              )}
            </div>
          </div>

          {github.connected ? (
            <div className="mt-5 space-y-4 border-t border-sage/10 pt-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-dark">Repository</label>
                <div className="flex gap-2">
                  {repos.length > 0 ? (
                    <select
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      className="flex-1 rounded-card border border-sage/20 bg-white px-4 py-2.5 text-sm text-dark outline-none transition-colors duration-200 focus:border-sage"
                    >
                      <option value="">Select a repository…</option>
                      {repos.map((r) => (
                        <option key={r.full_name} value={r.full_name}>
                          {r.full_name}{r.private ? " (private)" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="owner/repository"
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      className="flex-1 rounded-card border border-sage/20 bg-white px-4 py-2.5 text-sm text-dark outline-none transition-colors duration-200 focus:border-sage"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => void loadRepos()}
                    disabled={loadingRepos}
                    className="rounded-card border border-sage/20 px-3 py-2.5 text-xs text-mid transition hover:border-sage/40 disabled:opacity-60"
                  >
                    {loadingRepos ? "Loading…" : "Browse"}
                  </button>
                </div>
                <p className="text-xs text-mid">The repository SuppGo will open PRs against.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-dark">Content directory</label>
                <input
                  type="text"
                  placeholder="content/pages"
                  value={githubDir}
                  onChange={(e) => setGithubDir(e.target.value)}
                  className="w-full rounded-card border border-sage/20 bg-white px-4 py-2.5 text-sm text-dark outline-none transition-colors duration-200 focus:border-sage"
                />
                <p className="text-xs text-mid">
                  Relative path in the repo where content files will be committed. Leave blank for
                  the repo root.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveGithubConfig}
                  disabled={isGithubPending}
                  className="btn-primary px-5 py-2.5 disabled:opacity-60"
                >
                  {isGithubPending ? "Saving…" : "Save configuration"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-card border border-sage/10 bg-white/60 p-5 opacity-60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-card border border-sage/20 bg-sage/5 text-sm font-bold text-dark">
              CMS
            </div>
            <div>
              <div className="font-medium text-dark">Headless CMS</div>
              <div className="mt-0.5 text-xs text-mid">Webflow, Contentful, Sanity, Shopify — coming soon</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
