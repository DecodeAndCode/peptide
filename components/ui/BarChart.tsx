import type { CSSProperties } from "react";
import type { MarketingMetric } from "@/types";

export function BarChart({ label, value, delay = "0s" }: MarketingMetric) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[0.72rem] text-mid">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-sage/15">
        <div
          className="bar-fill h-full rounded bg-gradient-to-r from-[var(--sage-light)] to-[var(--sage)]"
          style={
            {
              "--target-width": value,
              "--delay": delay,
            } as CSSProperties
          }
        />
      </div>
    </div>
  );
}
