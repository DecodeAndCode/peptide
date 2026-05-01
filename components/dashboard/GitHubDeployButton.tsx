"use client";

import { useState } from "react";

interface GitHubDeployButtonProps {
  contentId: string;
  className?: string;
}

interface DeployResult {
  pr_url: string;
  branch_name: string;
}

export function GitHubDeployButton({ contentId, className = "mt-3" }: GitHubDeployButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDeploy() {
    setState("loading");
    setErrorMessage(null);

    const res = await fetch("/api/integrations/github/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_id: contentId }),
    });

    const data = (await res.json().catch(() => null)) as (DeployResult & { error?: string }) | null;

    if (!res.ok || !data?.pr_url) {
      setState("error");
      setErrorMessage(data?.error ?? "Failed to create GitHub PR.");
      return;
    }

    setPrUrl(data.pr_url);
    setState("done");
  }

  if (state === "done" && prUrl) {
    return (
      <a
        href={prUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} inline-flex items-center gap-1.5 text-xs font-medium text-sage underline-offset-2 hover:underline`}
      >
        <span>PR open on GitHub</span>
        <span>↗</span>
      </a>
    );
  }

  if (state === "error") {
    return (
      <div className={`${className} space-y-1`}>
        <p className="text-xs text-accent">{errorMessage}</p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="text-xs text-mid underline-offset-2 hover:underline"
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
      className={`${className} inline-flex items-center gap-1.5 rounded-pill border border-sage/20 px-3 py-1.5 text-xs font-medium text-dark transition hover:border-sage hover:bg-sage/5 disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {state === "loading" ? (
        <>
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-sage border-t-transparent" />
          Opening PR…
        </>
      ) : (
        <>Push to GitHub</>
      )}
    </button>
  );
}
