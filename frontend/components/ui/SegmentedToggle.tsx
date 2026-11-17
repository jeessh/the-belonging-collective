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
  size = "md",
  className = "",
}: {
  /** Accessible name for the group, e.g. "View". */
  label: string;
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  shape?: "square" | "pill";
  /**
   * `md` (default) is the member app's large type. `sm` is the console's:
   * 14px text, 36px tall, slightly squarer corners.
   */
  size?: "md" | "sm";
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
  const sm = size === "sm";
  const track = pill
    ? "rounded-full border border-line bg-surface p-1"
    : `${sm ? "rounded-md" : "rounded-control"} border border-line bg-surface`;
  // The border colour lives only on the state classes: two border colours on
  // one element resolve by stylesheet order, not class order, and the
  // transparent one was winning over the selected cyan.
  const segmentBase = pill
    ? "rounded-full border px-4 py-2"
    : sm
      ? "rounded-md border px-3 py-1.5"
      : "rounded-control border px-3 py-2 sm:px-6";
  const type = sm
    ? "min-h-9 min-w-9 gap-2 text-sm"
    : "min-h-11 min-w-11 gap-3 text-base sm:text-lg";
  const selected = pill
    ? "border-transparent bg-primary-active"
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
            className={`inline-flex items-center justify-center whitespace-nowrap text-fg transition-colors ${type} ${segmentBase} ${
              checked ? selected : "border-transparent hover:bg-surface-subtle"
            }`}
          >
            {seg.icon && (
              <span
                aria-hidden="true"
                className={`shrink-0 ${sm ? "[&>svg]:size-4" : "[&>svg]:size-6"}`}
              >
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
