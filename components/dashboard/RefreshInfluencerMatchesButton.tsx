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
        | { error?: string; matches?: { count: number } }
        | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "Unable to refresh influencer matches right now.");
        return;
      }

      setMessage(
        `Refreshed ${payload?.matches?.count ?? 0} influencer ${payload?.matches?.count === 1 ? "match" : "matches"}.`,
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
      {message ? <p className="text-sm text-mid">{message}</p> : null}
    </div>
  );
}
