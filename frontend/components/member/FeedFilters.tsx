"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Event } from "@/lib/api";
import { isUpcoming } from "@/lib/time";
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

type Chip = { key: string; label: string };

/**
 * Every chip, the member's top ones first: FREE, then their own interests,
 * then the topics with the most upcoming programs (ties keep the topics' own
 * order). Choosing a chip doesn't move it, so the row never jumps.
 */
export function rankChips(
  all: Chip[],
  interests: string[],
  events: Event[],
): Chip[] {
  const count = new Map<string, number>();
  for (const ev of events) {
    if (!isUpcoming(ev)) continue;
    const own = ev.categories?.length ? ev.categories : [ev.category];
    for (const slug of new Set(own)) {
      if (slug) count.set(slug, (count.get(slug) ?? 0) + 1);
    }
  }
  const order = new Map(all.map((c, i) => [c.key, i]));
  const rank = (c: Chip): number[] => {
    const interest = interests.indexOf(c.key);
    return [
      c.key === FREE_CHIP ? 0 : 1,
      interest === -1 ? interests.length : interest,
      -(count.get(c.key) ?? 0),
      order.get(c.key) ?? 0,
    ];
  };
  return [...all].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  });
}

/** The round arrow either side of the row. */
function ScrollArrow({
  dir,
  onClick,
}: {
  dir: "prev" | "next";
  onClick: () => void;
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous filters" : "More filters"}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-primary-strong bg-surface text-fg transition-colors hover:bg-primary-soft"
    >
      <Icon aria-hidden="true" className="size-6" />
    </button>
  );
}

export const FeedFilters = memo(function FeedFilters({
  chips,
  onToggleChip,
  interests = [],
  events = [],
}: {
  chips: Set<string>;
  onToggleChip: (chip: string) => void;
  /** The member's interest slugs; their topics come first. */
  interests?: string[];
  /** The whole feed, unfiltered, to rank the other topics by. */
  events?: Event[];
}) {
  const { categories } = useCategories();
  const all = useMemo(
    () =>
      rankChips(
        [
          { key: FREE_CHIP, label: "Free" },
          ...categories.map((c) => ({ key: c.slug, label: c.label })),
        ],
        interests,
        events,
      ),
    [categories, interests, events],
  );

  // Whether there is more of the row to either side, for the arrows.
  const rowRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ prev: false, next: false });
  const update = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    setMore({ prev: row.scrollLeft > 1, next: row.scrollLeft < max - 1 });
  }, []);
  useEffect(() => {
    update();
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(row);
    return () => ro.disconnect();
  }, [update, all]);

  // One press moves about a row's width: forward, the chip fading at the
  // edge becomes the first one in view; back, the same distance the other way.
  const scroll = (dir: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    const pad = parseFloat(getComputedStyle(row).paddingLeft) || 0;
    const kids = Array.from(row.children) as HTMLElement[];
    const edge = row.scrollLeft + row.clientWidth - 48; // where the fade starts
    // A chip's left edge within the row's scrolling content.
    const at = (el: HTMLElement) => el.offsetLeft - row.offsetLeft - pad;
    if (dir === 1) {
      // The first chip cut off by the fade — or, where the row is so narrow
      // that the first chip in view is itself cut off, the one after it.
      const next = kids.find(
        (el) => at(el) + el.offsetWidth > edge && at(el) > row.scrollLeft + 1,
      );
      row.scrollTo({
        left: next ? at(next) : row.scrollWidth,
        behavior,
      });
    } else {
      row.scrollBy({ left: -(row.clientWidth - 48), behavior });
    }
  };

  return (
    <div className="flex flex-col gap-4" data-tour="filters">
      <p
        id="feed-filters-label"
        className="text-xl uppercase tracking-wide text-fg-muted"
      >
        Event filters
      </p>
      <div className="flex items-center gap-3">
        {more.prev && <ScrollArrow dir="prev" onClick={() => scroll(-1)} />}
        {/* One row at every width, as drawn: the topics outnumber the
            frame's seven, so the row scrolls sideways (the edge fades where
            it continues) rather than wrapping into the card's space. The
            arrows scroll it too, for anyone without a trackpad or a swipe. */}
        <div
          ref={rowRef}
          role="group"
          aria-labelledby="feed-filters-label"
          onScroll={update}
          className="-my-1.5 flex min-w-0 flex-1 gap-3 overflow-x-auto scroll-fade-x py-1.5 pr-12 lg:gap-[19px]"
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
        {more.next && <ScrollArrow dir="next" onClick={() => scroll(1)} />}
      </div>
    </div>
  );
});
