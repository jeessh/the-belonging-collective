"use client";

import { useId, type ReactNode } from "react";

/**
 * An on/off switch with its label beside it: a `role="switch"` button, so a
 * screen reader says "on" / "off" and Space or Enter flips it. Blue when on,
 * grey when off. The console's event form uses it for Special access and
 * Attendee limit.
 */
export function Switch({
  checked,
  onChange,
  label,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border ${
          checked ? "bg-primary-strong" : "bg-line"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
      <span id={id} className="field-label text-lg font-medium text-fg">
        {label}
      </span>
    </div>
  );
}
