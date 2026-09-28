"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

export const HOLD_TIP = "Saving holds your spot for 1 hour.";

/**
 * The (i) at the top right of a program with a capacity. Hover, focus or tap
 * shows the one sentence; the sentence is always in the DOM and linked with
 * `aria-describedby`, so a screen reader hears it without any of that.
 */
export function HoldInfo({ className = "" }: { className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  // Hover already opened it for a mouse; a click then must not close it.
  const pointer = useRef<string>("");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    // The outer span takes the caller's placement; the inner one anchors the
    // tooltip, so an `absolute` from outside never fights this `relative`.
    <span className={className}>
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="About holding a spot"
        aria-describedby={id}
        aria-expanded={open}
        onPointerDown={(e) => {
          pointer.current = e.pointerType;
          // Never the start of a card drag.
          e.stopPropagation();
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => {
          if (pointer.current !== "mouse") setOpen((o) => !o);
        }}
        className="grid size-11 place-items-center rounded-full text-fg-icon transition-colors hover:bg-surface-subtle"
      >
        <Info aria-hidden="true" className="size-6" />
      </button>
      <span
        role="tooltip"
        id={id}
        className={
          open
            ? "absolute right-0 top-full z-20 mt-1 w-max max-w-[min(16rem,80vw)] rounded-control border border-line bg-surface px-3 py-2 text-base text-fg shadow-lift"
            : "sr-only"
        }
      >
        {HOLD_TIP}
      </span>
    </span>
    </span>
  );
}
