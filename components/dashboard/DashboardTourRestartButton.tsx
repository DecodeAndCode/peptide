"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  DASHBOARD_TOUR_PENDING_KEY,
  DASHBOARD_TOUR_RESTART_EVENT,
} from "@/components/dashboard/dashboard-tour-shared";

export function DashboardTourRestartButton() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn-outline inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
      aria-label="Replay dashboard tour"
      title="Replay dashboard tour"
      onClick={() => {
        if (pathname === "/dashboard") {
          window.dispatchEvent(new CustomEvent(DASHBOARD_TOUR_RESTART_EVENT));
          return;
        }
        try {
          sessionStorage.setItem(DASHBOARD_TOUR_PENDING_KEY, "1");
        } catch {
          /* ignore */
        }
        router.push("/dashboard");
      }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 20.25 3.75 17.48V6.52L9 3.75m0 16.5L14.25 17.48V6.52L9 3.75M9 20.25v-16.5m5.25 16.5 5.25-2.77V6.52L14.25 3.75"
        />
      </svg>
      Tour
    </button>
  );
}
