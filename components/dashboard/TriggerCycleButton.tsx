"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function TriggerCycleButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleTrigger() {
    setMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/cycles/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; cycle?: { cycleNumber: number; totalPromptExecutions: number } }
        | null;

      if (!response.ok) {
        setErrorMessage(payload?.error ?? "Unable to trigger the cycle.");
        return;
      }

      setMessage(
        `Cycle #${payload?.cycle?.cycleNumber ?? "?"} finished with ${payload?.cycle?.totalPromptExecutions ?? 0} prompt executions.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleTrigger}
        disabled={isPending}
        className="btn-primary px-5 py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Running cycle..." : "Run manual cycle"}
      </button>
      {message ? <p className="text-sm text-sage">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
    </div>
  );
}
