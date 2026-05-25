"use client";

import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  DASHBOARD_TOUR_PENDING_KEY,
  DASHBOARD_TOUR_RESTART_EVENT,
} from "@/components/dashboard/dashboard-tour-shared";

const STORAGE_KEY = "suppgo_dashboard_tour_v1_done";

const Z_BACKDROP = 10040;
const Z_MODAL = 10060;

const GAP = 16;
const PAD = 16;

type PanelPlacement = "center" | "east" | "west" | "north" | "south";

const STEPS: readonly {
  id: string;
  title: string;
  body: string;
  /** Side placement at `xl` two-column layout; otherwise centers. */
  panelPlacement: PanelPlacement;
  /** Scroll `block` when bringing the target into view. */
  scrollBlock: ScrollLogicalPosition;
}[] = [
  {
    id: "overview",
    title: "Your visibility home",
    body: "This page summarizes how AI assistants talk about your brand—latest cycle scores, trend, categories, and priorities in one place.",
    panelPlacement: "center",
    scrollBlock: "center",
  },
  {
    id: "kpis",
    title: "Scores at a glance",
    body: "Visibility, change vs. last cycle, prompt count, and mention rate show whether you are gaining or losing presence in answers shoppers see.",
    panelPlacement: "south",
    scrollBlock: "start",
  },
  {
    id: "trend",
    title: "Trend over time",
    body: "The chart tracks completed cycles so you can see direction—not just a single snapshot after each run.",
    panelPlacement: "east",
    scrollBlock: "nearest",
  },
  {
    id: "cycle",
    title: "Run the next cycle",
    body: "Site readiness reflects your crawl; Run cycle kicks off fresh prompts from your profile. New runs refresh scores and draft suggestions.",
    panelPlacement: "west",
    scrollBlock: "nearest",
  },
  {
    id: "drafts",
    title: "Draft types",
    body: "Ingredient-interaction drafts target combination-style prompts; FAQ snippets cover other gaps; the brand context file helps assistants cite you consistently. Each draft card says why it exists.",
    panelPlacement: "north",
    scrollBlock: "nearest",
  },
] as const;

const HIGHLIGHT_CLASS = [
  "relative",
  "z-[10045]",
  "scroll-mt-24",
  "ring-2",
  "ring-sage",
  "ring-offset-4",
  "ring-offset-cream",
  "rounded-card",
] as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function resolvePlacement(raw: PanelPlacement, stepId: string): PanelPlacement {
  const xl = typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches;
  if (!xl && stepId === "trend") {
    return "south";
  }
  if (!xl && stepId === "cycle") {
    return "center";
  }
  return raw;
}

function computePanelPosition(
  target: DOMRect,
  modalW: number,
  modalH: number,
  placement: PanelPlacement,
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (placement === "center") {
    return {
      left: (vw - modalW) / 2,
      top: (vh - modalH) / 2,
    };
  }

  if (placement === "east") {
    let top = target.top + (target.height - modalH) / 2;
    top = clamp(top, PAD, vh - modalH - PAD);
    let left = target.right + GAP;
    if (left + modalW > vw - PAD) {
      left = vw - modalW - PAD;
    }
    left = clamp(left, PAD, vw - modalW - PAD);
    return { left, top };
  }

  if (placement === "west") {
    let left = target.left - modalW - GAP;
    let top = target.top + (target.height - modalH) / 2;
    if (left < PAD) {
      left = target.right + GAP;
    }
    if (left + modalW > vw - PAD) {
      left = vw - modalW - PAD;
    }
    top = clamp(top, PAD, vh - modalH - PAD);
    left = clamp(left, PAD, vw - modalW - PAD);
    return { left, top };
  }

  if (placement === "north") {
    let top = target.top - modalH - GAP;
    let left = target.left + (target.width - modalW) / 2;
    if (top < PAD) {
      top = target.bottom + GAP;
    }
    left = clamp(left, PAD, vw - modalW - PAD);
    top = clamp(top, PAD, vh - modalH - PAD);
    return { left, top };
  }

  if (placement === "south") {
    let top = target.bottom + GAP;
    let left = target.left + (target.width - modalW) / 2;
    if (top + modalH > vh - PAD) {
      top = target.top - modalH - GAP;
    }
    left = clamp(left, PAD, vw - modalW - PAD);
    top = clamp(top, PAD, vh - modalH - PAD);
    return { left, top };
  }

  return { left: (vw - modalW) / 2, top: (vh - modalH) / 2 };
}

export function DashboardWalkthrough() {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const modalPanelRef = useRef<HTMLDivElement>(null);
  const [panelOffset, setPanelOffset] = useState<{ left: number; top: number } | null>(null);

  const updatePanelPosition = useCallback((targetEl: HTMLElement, stepIndex: number) => {
    const modal = modalPanelRef.current;
    if (!modal) {
      return;
    }

    const stepMeta = STEPS[stepIndex];
    const placement = resolvePlacement(stepMeta.panelPlacement, stepMeta.id);
    const tr = targetEl.getBoundingClientRect();
    const { width: modalW, height: modalH } = modal.getBoundingClientRect();

    if (modalW < 4 || modalH < 4) {
      return;
    }

    const pos = computePanelPosition(tr, modalW, modalH, placement);
    setPanelOffset(pos);
  }, []);

  useEffect(() => {
    if (!isDashboard) {
      return;
    }
    try {
      if (sessionStorage.getItem(DASHBOARD_TOUR_PENDING_KEY) === "1") {
        sessionStorage.removeItem(DASHBOARD_TOUR_PENDING_KEY);
        setStep(0);
        setActive(true);
        return;
      }
      if (!localStorage.getItem(STORAGE_KEY)) {
        setActive(true);
      }
    } catch {
      setActive(true);
    }
  }, [isDashboard]);

  useEffect(() => {
    const onRestart = () => {
      setStep(0);
      setActive(true);
    };
    window.addEventListener(DASHBOARD_TOUR_RESTART_EVENT, onRestart);
    return () => window.removeEventListener(DASHBOARD_TOUR_RESTART_EVENT, onRestart);
  }, []);

  useEffect(() => {
    if (!isDashboard && active) {
      setActive(false);
    }
  }, [isDashboard, active]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setActive(false);
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);

  useLayoutEffect(() => {
    if (!active || !isDashboard || step < 0 || step >= STEPS.length) {
      return;
    }

    const id = STEPS[step].id;
    const el = document.querySelector(`[data-tour="${id}"]`) as HTMLElement | null;
    if (!el) {
      return;
    }

    el.classList.add(...HIGHLIGHT_CLASS);
    setPanelOffset(null);

    const { scrollBlock } = STEPS[step];
    el.scrollIntoView({ behavior: "auto", block: scrollBlock, inline: "nearest" });

    let raf2 = 0;
    let raf3 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        updatePanelPosition(el, step);
        raf3 = requestAnimationFrame(() => {
          updatePanelPosition(el, step);
        });
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(raf3);
      el.classList.remove(...HIGHLIGHT_CLASS);
    };
  }, [active, step, isDashboard, updatePanelPosition]);

  useEffect(() => {
    if (!active || !isDashboard) {
      return;
    }

    const id = STEPS[step]?.id;
    if (!id) {
      return;
    }

    const sync = () => {
      const el = document.querySelector(`[data-tour="${id}"]`) as HTMLElement | null;
      if (el) {
        updatePanelPosition(el, step);
      }
    };

    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [active, isDashboard, step, updatePanelPosition]);

  if (!active || !isDashboard) {
    return null;
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const panelStyle: CSSProperties = panelOffset
    ? { position: "fixed", left: panelOffset.left, top: panelOffset.top, zIndex: Z_MODAL }
    : {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: Z_MODAL,
      };

  const tourUi = (
    <>
      <div
        style={{ zIndex: Z_BACKDROP }}
        className="fixed inset-0 bg-dark/65 backdrop-blur-sm backdrop-saturate-50"
        aria-hidden="true"
      />
      <div
        ref={modalPanelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-tour-title"
        style={panelStyle}
        className="w-full max-w-xl rounded-card border border-sage/20 bg-white p-8 shadow-2xl sm:p-9"
      >
        <div className="text-sm font-medium uppercase tracking-[1.4px] text-sage">
          Quick tour {step + 1} / {STEPS.length}
        </div>
        <h2 id="dashboard-tour-title" className="mt-3 font-display text-3xl text-dark leading-snug">
          {current.title}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-mid">{current.body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={dismiss}
            className="text-base text-mid underline-offset-4 hover:text-dark hover:underline"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="rounded-card border border-sage/25 px-5 py-2.5 text-base font-medium text-dark transition hover:border-sage/40"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (isLast) {
                  dismiss();
                } else {
                  setStep((s) => s + 1);
                }
              }}
              className="btn-primary px-5 py-2.5 text-base"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(tourUi, document.body);
}
