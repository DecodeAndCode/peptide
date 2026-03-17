"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/influencers", label: "Influencers" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-full flex-col justify-between bg-dark px-6 py-8 text-white lg:w-[260px] lg:fixed lg:inset-y-0 lg:left-0">
      <div>
        <Link href="/" className="font-display text-3xl leading-none tracking-[-0.5px]">
          Supp<span className="text-sage">Go</span>
        </Link>

        <div className="mt-10 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-card px-4 py-3 text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/65 hover:bg-white/6 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="rounded-card border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/70">
        The shell is live. Visibility analytics, reports, and influencer workflows plug into
        these routes in the next build steps.
      </div>
    </aside>
  );
}
