"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Circle,
  CircleDollarSign,
  Clipboard,
  Contact,
  PartyPopper,
} from "lucide-react";
import type { Event } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";
import { DIMENSIONS, bucketsFor, type DimensionKey } from "@/lib/dimensions";
import { buttonClass } from "@/components/ui/Button";
import { EventSummary } from "@/components/ui/EventSummary";
import { ConsoleCounts } from "@/components/host/ConsoleCounts";
import { CopyLinkButton } from "@/components/CopyLinkButton";

/* ---------------- filters ---------------- */

/** Chosen bucket ids per dimension. Empty means "don't filter on this". */
export type HostFilters = Partial<Record<DimensionKey, string[]>>;

export const NO_HOST_FILTERS: HostFilters = {};

export function applyHostFilters(
  events: Event[],
  filters: HostFilters,
  query: string,
): Event[] {
  const q = query.trim().toLowerCase();
  const active = DIMENSIONS.filter((d) => filters[d.key]?.length);
  return events.filter((ev) => {
    for (const d of active) {
      if (!filters[d.key]?.includes(d.bucket(ev).id)) return false;
    }
    if (q) {
      const hay = [ev.title, ev.description, ev.location, ev.host_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// The design's icon per group. Its "Price" is the feed's "Cost" dimension.
const GROUP: Record<DimensionKey, { label: string; icon: ReactNode }> = {
  org: { label: "Non-Profit Org.", icon: <Building2 /> },
  price: { label: "Price", icon: <CircleDollarSign /> },
  registration: { label: "Registration Type", icon: <Clipboard /> },
  eventType: { label: "Event Type", icon: <Contact /> },
  activityType: { label: "Activity Type", icon: <PartyPopper /> },
};

/**
 * The accordion beside the list. Groups are the feed's dimensions, so a
 * console filter and a member's "See events by" can never disagree about
 * which bucket a program is in. Options are whatever the loaded programs
 * actually fall into — a group with nothing to choose says so.
 */
export const FilterPanel = memo(function FilterPanel({
  events,
  filters,
  onChange,
}: {
  events: Event[];
  filters: HostFilters;
  onChange: (next: HostFilters) => void;
}) {
  const [open, setOpen] = useState<Partial<Record<DimensionKey, boolean>>>({});
  // Activity Type labels come from the topic list; recompute when it lands.
  const categories = useCategories();

  const options = useMemo(() => {
    const byKey = new Map<DimensionKey, { id: string; label: string }[]>();
    for (const d of DIMENSIONS) {
      byKey.set(
        d.key,
        bucketsFor(events, d).sort((a, b) => a.label.localeCompare(b.label)),
      );
    }
    return byKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, categories]);

  function toggle(key: DimensionKey, id: string) {
    const cur = filters[key] ?? [];
    onChange({
      ...filters,
      [key]: cur.includes(id) ? cur.filter((v) => v !== id) : [...cur, id],
    });
  }

  const anyChosen = DIMENSIONS.some((d) => filters[d.key]?.length);

  return (
    <aside
      aria-label="Filter events"
      className="w-full rounded-control border border-line bg-surface px-2.5 py-3.5 lg:w-[431px] lg:shrink-0"
    >
      {DIMENSIONS.map((d) => {
        const isOpen = open[d.key] ?? false;
        const chosen = filters[d.key] ?? [];
        const group = GROUP[d.key];
        const choices = options.get(d.key) ?? [];
        return (
          <div key={d.key} className="border-b border-line-active">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [d.key]: !isOpen }))}
              aria-expanded={isOpen}
              className="flex min-h-11 w-full items-center gap-6 px-3 py-2 text-left text-2xl text-fg"
            >
              <span aria-hidden="true" className="w-6 shrink-0 text-fg-icon [&>svg]:size-6">
                {group.icon}
              </span>
              <span className="flex-1">{group.label}</span>
              {chosen.length > 0 && (
                <span className="grid h-7 min-w-7 place-items-center rounded-full bg-primary px-2 text-base font-medium text-fg">
                  {chosen.length}
                  <span className="sr-only"> selected</span>
                </span>
              )}
              <ChevronDown
                aria-hidden="true"
                className={`size-6 shrink-0 text-fg-icon transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="flex flex-col gap-2 px-3 pb-3 pl-[60px]">
                {choices.length === 0 && (
                  <p className="text-lg text-fg-muted">Nothing to filter by yet.</p>
                )}
                {choices.map((o) => (
                  <label
                    key={o.id}
                    className="flex min-h-11 items-center gap-3 text-xl text-fg"
                  >
                    <input
                      type="checkbox"
                      checked={chosen.includes(o.id)}
                      onChange={() => toggle(d.key, o.id)}
                      className="size-5 shrink-0 accent-primary-border"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange(NO_HOST_FILTERS)}
        aria-pressed={!anyChosen}
        className="flex min-h-11 w-full items-center gap-6 px-3 py-2 text-left text-2xl text-fg"
      >
        <span aria-hidden="true" className="grid w-6 shrink-0 place-items-center text-fg-icon">
          <Circle className={`size-3 ${anyChosen ? "" : "fill-current"}`} />
        </span>
        All Events
      </button>
    </aside>
  );
});

/* ---------------- event card ---------------- */

/**
 * One program in the list: the shared summary in a bordered card, with "N
 * going", a copy-link button (every row needs one — that is how organizers
 * advertise) and the way to the details page.
 */
export const PostedEventCard = memo(function PostedEventCard({
  event,
}: {
  event: Event;
}) {
  return (
    <article
      id={`event-${event.id}`}
      aria-label={event.title}
      className="rounded-control border border-line bg-surface p-4 sm:p-6"
    >
      <EventSummary
        event={event}
        going={<ConsoleCounts event={event} />}
        actions={
          <>
            <CopyLinkButton eventId={event.id} title={event.title} iconOnly />
            <Link
              href={`/host/events/${event.id}`}
              className={buttonClass("secondary")}
            >
              View Details
              <span className="sr-only"> for {event.title}</span>
              <ArrowRight aria-hidden="true" className="size-6" />
            </Link>
          </>
        }
      />
    </article>
  );
});
