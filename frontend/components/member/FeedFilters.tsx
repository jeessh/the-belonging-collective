"use client";

import { memo } from "react";
import type { Event } from "@/lib/api";
import { CATEGORIES, sameCategory } from "@/lib/categories";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";

/** "free", or a canonical topic label from `CATEGORIES`. */
export const FREE_CHIP = "free";

export type FeedSort = "foryou" | "soonest";

const SORTS = [
  { value: "foryou" as const, label: "For you" },
  { value: "soonest" as const, label: "Soonest" },
];

/**
 * The member's explicit choice, so — unlike personalization — it may hide
 * cards. FREE is one axis and the topics another: an event passes when it
 * satisfies every axis that has something chosen, and any chip on that axis.
 */
export function passesFilters(event: Event, chips: Set<string>): boolean {
  if (chips.size === 0) return true;
  if (chips.has(FREE_CHIP) && !event.is_free) return false;
  const topics = [...chips].filter((c) => c !== FREE_CHIP);
  if (topics.length === 0) return true;
  const own = event.categories?.length ? event.categories : [event.category];
  return topics.some((t) => own.some((c) => sameCategory(t, c)));
}

export const FeedFilters = memo(function FeedFilters({
  chips,
  onToggleChip,
  sort,
  onSort,
}: {
  chips: Set<string>;
  onToggleChip: (chip: string) => void;
  sort: FeedSort;
  onSort: (sort: FeedSort) => void;
}) {
  const all = [
    { key: FREE_CHIP, label: "Free" },
    ...CATEGORIES.map((c) => ({ key: c.label, label: c.label })),
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          id="feed-filters-label"
          className="text-xl uppercase tracking-wide text-fg-muted"
        >
          Event filters
        </p>
        <SegmentedToggle
          label="Sort events"
          segments={SORTS}
          value={sort}
          onChange={onSort}
          shape="pill"
        />
      </div>
      {/* One scrolling row on a phone (the edge fades where it continues);
          from `sm` the chips wrap. The negative margin lets the row run to the
          screen edge while the chips still start at the gutter. */}
      <div
        role="group"
        aria-labelledby="feed-filters-label"
        className="flex gap-3 max-sm:-mx-4 max-sm:overflow-x-auto max-sm:scroll-px-4 max-sm:py-1 max-sm:pl-4 max-sm:pr-12 max-sm:scroll-fade-x sm:flex-wrap"
      >
        {all.map(({ key, label }) => {
          const on = chips.has(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onToggleChip(key)}
              className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-control border px-4 py-1 text-base uppercase tracking-wide transition-colors sm:text-lg ${
                on
                  ? "border-primary-border bg-primary-soft text-fg"
                  : "border-primary-strong bg-surface text-fg-muted hover:bg-primary-soft"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
});
