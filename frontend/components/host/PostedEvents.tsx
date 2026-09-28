"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  ChevronDown,
  CircleDollarSign,
  Clipboard,
  Contact,
  PartyPopper,
} from "lucide-react";
import type { Event } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";
import { DIMENSIONS, bucketsFor, type DimensionKey } from "@/lib/dimensions";
import { Checkbox } from "@/components/ui/Checkbox";

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
 * The component sheet's filter accordion. Groups are the feed's dimensions,
 * so a console filter and a member's "See events by" can never disagree
 * about which bucket a program is in. Options are whatever the loaded
 * programs actually fall into — a group with nothing to choose says so.
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
  const { categories } = useCategories();

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
      className="w-full rounded-card border border-line bg-surface px-2.5 py-2 lg:w-[431px] lg:shrink-0"
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
              className="flex min-h-14 w-full items-center gap-6 px-3 py-2 text-left text-xl text-fg"
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
              <div className="flex flex-col px-3 pb-3 pl-[60px]">
                {choices.length === 0 && (
                  <p className="min-h-11 text-lg text-fg-muted">
                    Nothing to filter by yet.
                  </p>
                )}
                {choices.map((o) => (
                  <Checkbox
                    key={o.id}
                    label={o.label}
                    className="text-fg-muted"
                    checked={chosen.includes(o.id)}
                    onChange={() => toggle(d.key, o.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* The sheet's radio row: on when no box above is ticked. */}
      <button
        type="button"
        role="radio"
        aria-checked={!anyChosen}
        onClick={() => onChange(NO_HOST_FILTERS)}
        className="flex min-h-14 w-full items-center gap-6 px-3 py-2 text-left text-xl text-fg"
      >
        <span
          aria-hidden="true"
          className="grid w-6 shrink-0 place-items-center text-fg-icon"
        >
          <span
            className={`size-3 rounded-full border-2 border-current ${
              anyChosen ? "" : "bg-current"
            }`}
          />
        </span>
        All Events
      </button>
    </aside>
  );
});
