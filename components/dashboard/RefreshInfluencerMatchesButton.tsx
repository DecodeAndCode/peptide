"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RefreshInfluencerMatchesButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/influencers/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            matches?: { count: number };
          }
        | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "Unable to refresh influencer matches right now.");
        return;
      }

      const matchCount = payload?.matches?.count ?? 0;

      if (matchCount === 0) {
        setMessage(
          "No new creator matches were saved. Try again in a few minutes, or run another visibility cycle to refresh context.",
        );
        router.refresh();
        return;
      }

      setMessage(
        `Updated ${matchCount} creator ${matchCount === 1 ? "match" : "matches"}. Your top suggestions are shown below.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isPending}
        className="btn-primary px-5 py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Refreshing..." : "Refresh Matches"}
      </button>
      {message ? <p className="text-sm text-mid whitespace-pre-line">{message}</p> : null}
    </div>
  );
}
