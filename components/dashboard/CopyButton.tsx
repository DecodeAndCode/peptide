"use client";

import { useState, useTransition } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCopy() {
    startTransition(async () => {
      await navigator.clipboard.writeText(value);
      setMessage("Copied");
      window.setTimeout(() => setMessage(null), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isPending}
      className="rounded-pill border border-sage/15 bg-white px-4 py-2 text-xs font-medium text-dark transition hover:-translate-y-0.5 disabled:opacity-60"
    >
      {message ?? label}
    </button>
  );
}
