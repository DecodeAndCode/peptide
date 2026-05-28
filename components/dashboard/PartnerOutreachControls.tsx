"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PartnerOutreachStatus } from "@/types";

interface PartnerOutreachControlsProps {
  partnerId: string;
  initialStatus: PartnerOutreachStatus | null;
  initialNotes: string | null;
}

const STATUS_OPTIONS: Array<{ value: PartnerOutreachStatus; label: string }> = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "contacted", label: "Contacted" },
  { value: "responded", label: "Responded" },
  { value: "partnered", label: "Partnered" },
  { value: "archived", label: "Archived" },
];

export function PartnerOutreachControls({
  partnerId,
  initialStatus,
  initialNotes,
}: PartnerOutreachControlsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<PartnerOutreachStatus>(initialStatus ?? "not_contacted");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/partners/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, outreachStatus: status, outreachNotes: notes }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "Unable to save outreach status.");
        return;
      }

      setMessage("Saved.");
      router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-card border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase tracking-[1.4px] text-white/60">Outreach status</label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as PartnerOutreachStatus)}
          className="rounded-card border border-white/15 bg-dark px-3 py-1.5 text-xs text-white outline-none"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-card border border-sage/30 bg-sage/20 px-3 py-1.5 text-xs font-medium text-sage-light transition hover:bg-sage/30 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        {message ? <span className="text-xs text-white/70">{message}</span> : null}
      </div>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={2}
        placeholder="Notes on outreach progress..."
        className="mt-3 w-full rounded-card border border-white/15 bg-dark px-3 py-2 text-xs text-white outline-none"
      />
    </div>
  );
}
