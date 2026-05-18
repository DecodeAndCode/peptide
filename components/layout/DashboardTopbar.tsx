import { signOutAction } from "@/app/(auth)/actions";
import { DashboardTourRestartButton } from "@/components/dashboard/DashboardTourRestartButton";
import { Badge } from "@/components/ui/Badge";
import type { BrandRecord, CycleRecord } from "@/types";

interface DashboardTopbarProps {
  brand: BrandRecord;
  latestCycle: CycleRecord | null;
}

function getCycleLabel(latestCycle: CycleRecord | null) {
  if (!latestCycle) {
    return "Awaiting first cycle";
  }

  if (latestCycle.status === "running") {
    return `Cycle #${latestCycle.cycle_number} running`;
  }

  if (latestCycle.status === "complete") {
    return `Cycle #${latestCycle.cycle_number} complete`;
  }

  if (latestCycle.status === "failed") {
    return `Cycle #${latestCycle.cycle_number} failed`;
  }

  return `Cycle #${latestCycle.cycle_number} pending`;
}

export function DashboardTopbar({ brand, latestCycle }: DashboardTopbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-sage/12 bg-cream/90 px-6 py-5 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="text-xs font-medium uppercase tracking-[1.8px] text-sage">
          Visibility dashboard
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl text-dark">{brand.brand_name}</h1>
          <Badge>{getCycleLabel(latestCycle)}</Badge>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-start gap-3 sm:justify-end">
        <DashboardTourRestartButton />
        <button
          type="button"
          disabled
          aria-label="Notifications (coming soon)"
          title="Notifications are not available yet"
          className="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-full border border-sage/15 bg-white text-dark opacity-45"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6.5 8.5a5.5 5.5 0 1 1 11 0v4.2l1.4 2.6a1 1 0 0 1-.88 1.47H5.98a1 1 0 0 1-.88-1.47l1.4-2.6V8.5Z" />
            <path d="M10 18.5a2 2 0 0 0 4 0" />
          </svg>
        </button>

        <form action={signOutAction}>
          <button type="submit" className="btn-outline px-5 py-2.5">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
