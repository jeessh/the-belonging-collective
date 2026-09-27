"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

export const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Accessible dialog shell: focus trap, Esc/backdrop/X to close, focus restore.
// Drawn as the design's Modal Card: large radius, blurred dim backdrop, X top
// right. The X sits last in the DOM so the first control inside still takes
// initial focus.
const SIZE = {
  md: "max-w-lg",
  lg: "max-w-[960px]",
};

/**
 * Is this dialog the one on top? Sheets portal to the end of `<body>`, so
 * the last modal dialog in document order is the one the keyboard belongs
 * to. Every keyboard trap on a dialog should ask this before acting.
 */
export function isTopmostDialog(el: Element | null): boolean {
  if (!el) return false;
  const all = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
  return all[all.length - 1] === el;
}

export function Modal({
  title,
  onClose,
  children,
  labelId,
  size = "md",
}: {
  /**
   * The heading. Pass null when the heading is inside `children` (with
   * `labelId` naming it), as the event dialog does.
   */
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional id override for the heading (defaults to a generated id). */
  labelId?: string;
  /** `lg` is the design's Expanded Card width. */
  size?: keyof typeof SIZE;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const generatedId = useId();
  const headingId = labelId ?? generatedId;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first focusable control, else the panel itself.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    // Only the topmost dialog owns the keyboard: a share sheet opened from the
    // event dialog must not have Escape close both, or Tab cycle the one
    // underneath.
    function onKeyDown(e: KeyboardEvent) {
      if (!isTopmostDialog(panel)) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || active === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // stop background scroll
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-fg/40 px-4 py-8 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          tabIndex={-1}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className={`relative w-full ${SIZE[size]} rounded-card border border-line bg-surface p-6 shadow-lift outline-none sm:p-10`}
        >
          {title == null ? null : typeof title === "string" ? (
            <h2
              id={headingId}
              className="pr-12 text-2xl font-medium text-fg sm:text-3xl"
            >
              {title}
            </h2>
          ) : (
            <div id={headingId} className="pr-12">
              {title}
            </div>
          )}
          {children}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-control text-fg-icon hover:bg-surface-subtle sm:right-6 sm:top-6"
          >
            <X aria-hidden="true" className="size-8" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
