"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

type InfoHintProps = {
  children: ReactNode;
  /** Accessible label for the trigger (tooltip body is linked via aria-describedby when open). */
  triggerLabel?: string;
};

export function InfoHint({ children, triggerLabel = "What this means" }: InfoHintProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 180);
  }, [cancelClose]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) {
      return;
    }
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 8, left: r.left + r.width / 2 });
  }, []);

  const show = useCallback(() => {
    cancelClose();
    updatePosition();
    setOpen(true);
  }, [cancelClose, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        cancelClose();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, cancelClose]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-sage/45 bg-white text-[9px] font-bold leading-none text-sage shadow-sm transition hover:border-sage hover:bg-sage/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
        aria-label={triggerLabel}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
      >
        ?
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                transform: "translateX(-50%)",
              }}
              className="z-[200] w-max max-w-xs rounded-lg border border-sage/20 bg-white p-3 text-left text-xs font-normal normal-case leading-5 tracking-normal text-mid shadow-lg"
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              {children}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
