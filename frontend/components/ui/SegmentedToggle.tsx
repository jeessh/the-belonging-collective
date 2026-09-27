"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type Segment<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Show the icon alone; the label becomes the accessible name. */
  iconOnly?: boolean;
};

/**
 * A radio group drawn as one control: the View Toggle (Card | List), the
 * console's Your Events | All Events, and the sign-in Icon | Password switch.
 *
 * `shape="square"` is the design's View Toggle — outlined segments, the
 * selected one cyan. `shape="pill"` is its Option Toggle — one rounded track
 * with a solid cyan thumb — which is what an icon-only switch wants.
 *
 * Arrow keys move the selection, as with native radios; Tab lands on the
 * selected segment only.
 */
export function SegmentedToggle<T extends string>({
  label,
  segments,
  value,
  onChange,
  shape = "square",
  className = "",
}: {
  /** Accessible name for the group, e.g. "View". */
  label: string;
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  shape?: "square" | "pill";
  className?: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = segments.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    onChange(segments[next].value);
    buttons.current[next]?.focus();
  }

  const pill = shape === "pill";
  const track = pill
    ? "rounded-full border border-line bg-surface p-1"
    : "rounded-control border border-line bg-surface";
  const segmentBase = pill
    ? "rounded-full border border-transparent px-4 py-2"
    : "rounded-control border border-transparent px-4 py-2 sm:px-6";
  const selected = pill
    ? "bg-primary-active"
    : "border-primary-border bg-primary-soft";

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex items-stretch ${track} ${className}`}
    >
      {segments.map((seg, i) => {
        const checked = seg.value === value;
        return (
          <button
            key={seg.value}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={seg.iconOnly ? seg.label : undefined}
            title={seg.iconOnly ? seg.label : undefined}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(seg.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-3 whitespace-nowrap text-base text-fg transition-colors sm:text-lg ${segmentBase} ${
              checked ? selected : "hover:bg-surface-subtle"
            }`}
          >
            {seg.icon && (
              <span aria-hidden="true" className="shrink-0 [&>svg]:size-6">
                {seg.icon}
              </span>
            )}
            {!seg.iconOnly && seg.label}
          </button>
        );
      })}
    </div>
  );
}
