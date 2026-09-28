"use client";

import { memo } from "react";
import type { Event } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";
import { FilterChip } from "@/components/ui/FilterChip";

/** "free", or a topic slug from `GET /categories`. */
export const FREE_CHIP = "free";

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
  return topics.some((t) => own.includes(t));
}

export const FeedFilters = memo(function FeedFilters({
  chips,
  onToggleChip,
}: {
  chips: Set<string>;
  onToggleChip: (chip: string) => void;
}) {
  const { categories } = useCategories();
  const all = [
    { key: FREE_CHIP, label: "Free" },
    ...categories.map((c) => ({ key: c.slug, label: c.label })),
  ];
  return (
    <div className="flex flex-col gap-4" data-tour="filters">
      <p
        id="feed-filters-label"
        className="text-xl uppercase tracking-wide text-fg-muted"
      >
        Event filters
      </p>
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
            <FilterChip
              key={key}
              selected={on}
              onClick={() => onToggleChip(key)}
            >
              {label}
            </FilterChip>
          );
        })}
      </div>
    </div>
  );
});
