"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ReportActionButtons({
  cycleId,
  className,
}: {
  cycleId: string;
  className?: string;
}) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleEmail() {
    setStatusMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cycleId, sendEmail: true }),
      });

      if (!response.ok) {
        setStatusMessage("Unable to email the report right now.");
        return;
      }

      setStatusMessage("Report email sent.");
      router.refresh();
    });
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        <a href={`/api/reports/${cycleId}/download`} className="btn-primary px-5 py-2.5">
          Download PDF
        </a>
        <button
          type="button"
          onClick={handleEmail}
          disabled={isPending}
          className="btn-outline px-5 py-2.5 disabled:opacity-60"
        >
          {isPending ? "Sending..." : "Email report"}
        </button>
      </div>
      {statusMessage ? <p className="mt-3 text-sm text-mid">{statusMessage}</p> : null}
    </div>
  );
}
