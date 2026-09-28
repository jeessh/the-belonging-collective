"use client";

import { memo } from "react";
import { Sparkles } from "lucide-react";
import type { Event } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";
import { isThisWeek } from "@/lib/time";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";

/** "free", "thisweek", or a topic slug from `GET /categories`. */
export const FREE_CHIP = "free";
/** Starts today or within the following seven days, Toronto time. */
export const THIS_WEEK_CHIP = "thisweek";
/**
 * This week's picks only. Offered when there are any, and only in the card
 * view — the list shows them as a section instead. Allowed to hide cards
 * because it is the member's own choice, like every other chip.
 */
export const FOR_YOU_CHIP = "foryou";

export type FeedSort = "foryou" | "soonest";

const SORTS = [
  { value: "foryou" as const, label: "For you" },
  { value: "soonest" as const, label: "Soonest" },
];

/**
 * The member's explicit choice, so — unlike personalization — it may hide
 * cards. FREE and THIS WEEK are each an axis and the topics another: an event
 * passes when it satisfies every axis that has something chosen, and any chip
 * on that axis. The For-you chip is one more, checked by the caller against
 * its set.
 */
export function passesFilters(event: Event, chips: Set<string>): boolean {
  if (chips.size === 0) return true;
  if (chips.has(FREE_CHIP) && !event.is_free) return false;
  if (chips.has(THIS_WEEK_CHIP) && !isThisWeek(event)) return false;
  const topics = [...chips].filter(
    (c) => c !== FREE_CHIP && c !== THIS_WEEK_CHIP && c !== FOR_YOU_CHIP,
  );
  if (topics.length === 0) return true;
  const own = event.categories?.length ? event.categories : [event.category];
  return topics.some((t) => own.includes(t));
}

export const FeedFilters = memo(function FeedFilters({
  chips,
  onToggleChip,
  sort,
  onSort,
  forYou = false,
}: {
  chips: Set<string>;
  onToggleChip: (chip: string) => void;
  sort: FeedSort;
  onSort: (sort: FeedSort) => void;
  /** Offer the For-you chip. */
  forYou?: boolean;
}) {
  const categories = useCategories();
  const all = [
    ...(forYou ? [{ key: FOR_YOU_CHIP, label: "For you" }] : []),
    { key: FREE_CHIP, label: "Free" },
    { key: THIS_WEEK_CHIP, label: "This week" },
    ...categories.map((c) => ({ key: c.slug, label: c.label })),
  ];
  return (
    <div className="flex flex-col gap-4" data-tour="filters">
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
          const pick = key === FOR_YOU_CHIP;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onToggleChip(key)}
              data-tour={pick ? "foryou" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-control border px-4 py-1 text-base uppercase tracking-wide transition-colors sm:text-lg ${
                on
                  ? "border-primary-border bg-primary-soft text-fg"
                  : "border-primary-strong bg-surface text-fg-muted hover:bg-primary-soft"
              }`}
            >
              {pick && <Sparkles aria-hidden="true" className="size-5" />}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
});
