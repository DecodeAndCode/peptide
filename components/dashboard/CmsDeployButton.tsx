"use client";

import { useEffect, useMemo, useState } from "react";
import type { CmsDeploymentPreviewLink, CmsDeploymentRunStatus } from "@/types";

interface CmsDeployButtonProps {
  cycleId: string;
  connected: boolean;
  siteName: string | null;
  dryRun?: boolean;
}

interface CmsDeploymentResult {
  deployment: {
    id: string;
    status: CmsDeploymentRunStatus;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    preview_links: CmsDeploymentPreviewLink[];
    warnings: string[];
    error_message: string | null;
  };
  error?: string;
}

const PROGRESS_MESSAGES = [
  "Analyzing Webflow CMS…",
  "Matching recommendations to sections…",
  "Creating draft updates…",
  "Preparing preview links…",
];

export function CmsDeployButton({ cycleId, connected, siteName, dryRun = false }: CmsDeployButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [messageIndex, setMessageIndex] = useState(0);
  const [result, setResult] = useState<CmsDeploymentResult["deployment"] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (state !== "loading") return;
    const interval = window.setInterval(() => {
      setMessageIndex((current) => Math.min(current + 1, PROGRESS_MESSAGES.length - 1));
    }, 1400);
    return () => window.clearInterval(interval);
  }, [state]);

  const primaryLink = useMemo(() => {
    return result?.preview_links.find((link) => link.type === "webflow_dashboard") ?? result?.preview_links[0] ?? null;
  }, [result]);

  const reviewItems = useMemo(() => {
    return result?.preview_links.filter((link) => link.type === "cms_item") ?? [];
  }, [result]);

  async function handleDeploy() {
    if (!connected && !dryRun) return;

    setState("loading");
    setResult(null);
    setErrorMessage(null);
    setMessageIndex(0);

    const res = await fetch("/api/integrations/cms/deploy-cycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycle_id: cycleId, provider: "webflow", ...(dryRun ? { dry_run: true } : {}) }),
    });

    const data = (await res.json().catch(() => null)) as CmsDeploymentResult | null;

    if (!res.ok || !data?.deployment) {
      setState("error");
      setErrorMessage(data?.error ?? "Unable to apply CMS updates.");
      return;
    }

    setResult(data.deployment);
    setState(data.deployment.status === "failed" ? "error" : "done");
    setErrorMessage(data.deployment.error_message);
  }

  if (!connected && !dryRun) {
    return (
      <a href="/settings" className="btn-outline px-5 py-2.5 text-sm">
        Connect Webflow CMS
      </a>
    );
  }

  if (state === "done" && result) {
    return (
      <div className="rounded-card border border-sage/15 bg-sage/5 p-4">
        {dryRun ? (
          <div className="mb-3 rounded-card border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            Dry run — drafts were simulated with in-memory fixtures. Nothing was sent to Webflow.
          </div>
        ) : null}
        <div className="text-sm font-medium text-dark">CMS drafts ready{siteName ? ` in ${siteName}` : ""}</div>
        <p className="mt-2 text-xs leading-6 text-mid">
          Created {result.created_count}, updated {result.updated_count}, skipped {result.skipped_count}. Review the
          draft changes in Webflow before publishing.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {primaryLink ? (
            <a href={primaryLink.url} target="_blank" rel="noreferrer" className="btn-primary px-4 py-2 text-xs">
              Open Webflow Designer (CMS)
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setState("idle")}
            className="rounded-card border border-sage/20 px-3 py-2 text-xs text-mid transition hover:border-sage/40"
          >
            Apply again
          </button>
        </div>
        {reviewItems.length > 0 ? (
          <div className="mt-3 rounded-card border border-sage/10 bg-white/70 p-3">
            <p className="text-xs font-medium text-dark">Drafts to review in Webflow</p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-mid">
              {reviewItems.slice(0, 5).map((link) => (
                <li key={`${link.label}-${link.url}`}>{link.label}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {result.warnings.length > 0 ? (
          <div className="mt-3 space-y-1 text-xs leading-5 text-mid">
            {result.warnings.slice(0, 3).map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-card border border-accent/25 bg-accent/10 p-4">
        <p className="text-sm font-medium text-dark">CMS updates need attention</p>
        <p className="mt-2 text-xs leading-6 text-mid">{errorMessage ?? "SuppGO could not create Webflow drafts."}</p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-3 rounded-card border border-sage/20 px-3 py-2 text-xs text-mid transition hover:border-sage/40"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleDeploy()}
      disabled={state === "loading"}
      className={`${
        dryRun
          ? "rounded-card border border-amber-400 bg-amber-100 px-5 py-2.5 text-sm font-medium text-amber-900 hover:bg-amber-200"
          : "btn-primary px-5 py-2.5 text-sm"
      } disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {state === "loading"
        ? PROGRESS_MESSAGES[messageIndex]
        : dryRun
          ? "Try CMS deploy (dry run)"
          : "Apply CMS updates"}
    </button>
  );
}
