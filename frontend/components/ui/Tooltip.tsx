"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

/**
 * A short description of what a control does, shown on hover and on keyboard
 * focus, and read out with the control (`aria-describedby`) — for icon-only
 * buttons, where the native `title` tooltip is slow, mouse-only and silent.
 *
 * Escape hides it without moving focus, as a hover popup has to allow.
 * `children` gets the id to put in the control's `aria-describedby`.
 *
 * `side` is where it opens; `align="end"` lines its right edge up with the
 * control's, for one at the right edge of the screen.
 */
export function Tooltip({
  text,
  side = "bottom",
  align = "center",
  children,
}: {
  text: string;
  side?: "top" | "bottom";
  align?: "center" | "end";
  children: (describedBy: string) => ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={(e) => {
        // Keyboard focus only; a click focuses too, and shouldn't pop it.
        if ((e.target as HTMLElement).matches(":focus-visible")) setOpen(true);
      }}
      onBlur={() => setOpen(false)}
    >
      {children(id)}
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute z-20 w-max max-w-[16rem] rounded-md bg-fg px-2.5 py-1.5 text-xs leading-snug text-white shadow-lift transition-opacity ${
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
        } ${align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"} ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        {text}
      </span>
    </span>
  );
}
