"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  CalendarPlus,
  ChevronDown,
  CircleDot,
  UserRound,
  CircleDollarSign,
  Clipboard,
  Contact,
  PartyPopper,
} from "lucide-react";
import type { Event } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";
import { DIMENSIONS, bucketsFor, bucketsOf, type DimensionKey } from "@/lib/dimensions";
import { Checkbox } from "@/components/ui/Checkbox";

/* ---------------- filters ---------------- */

/**
 * The console's own groups, beside the feed's dimensions: when an event was
 * posted, who posted it, and where it stands. Members never filter by these.
 */
type ExtraKey = "posted" | "postedBy" | "status";
type FilterKey = DimensionKey | ExtraKey;

/** Chosen bucket ids per group. Empty means "don't filter on this". */
export type HostFilters = Partial<Record<FilterKey, string[]>>;

export const NO_HOST_FILTERS: HostFilters = {};

/** Published / Un-published, as the page knows it (archived rows are its own). */
export type StatusOf = (ev: Event) => "published" | "unpublished";
const publishedOnly: StatusOf = () => "published";

const DAY = 86_400_000;
const POSTED = [
  { id: "7", label: "Past 7 days", days: 7 },
  { id: "30", label: "Past 30 days", days: 30 },
  { id: "90", label: "Past 90 days", days: 90 },
];

/** Every bucket an event is in, per console group. "Past 30 days" includes
    "Past 7 days": ticking either finds what it says. */
function extraBuckets(key: ExtraKey, ev: Event, statusOf: StatusOf): { id: string; label: string }[] {
  if (key === "status")
    return statusOf(ev) === "published"
      ? [{ id: "published", label: "Published" }]
      : [{ id: "unpublished", label: "Un-published" }];
  if (key === "postedBy") {
    const who = ev.created_by_name || ev.host_name;
    return who ? [{ id: who, label: who }] : [];
  }
  if (!ev.created_at) return [];
  const age = Date.now() - new Date(ev.created_at).getTime();
  const within = POSTED.filter((p) => age <= p.days * DAY);
  return within.length ? within : [{ id: "older", label: "Older than 90 days" }];
}

const EXTRAS: ExtraKey[] = ["posted", "postedBy", "status"];

export function applyHostFilters(
  events: Event[],
  filters: HostFilters,
  query: string,
  statusOf: StatusOf = publishedOnly,
): Event[] {
  const q = query.trim().toLowerCase();
  const active = DIMENSIONS.filter((d) => filters[d.key]?.length);
  const extras = EXTRAS.filter((k) => filters[k]?.length);
  return events.filter((ev) => {
    for (const d of active) {
      const ids = bucketsOf(d, ev).map((b) => b.id);
      if (!filters[d.key]?.some((id) => ids.includes(id))) return false;
    }
    for (const k of extras) {
      const ids = extraBuckets(k, ev, statusOf).map((b) => b.id);
      if (!filters[k]?.some((id) => ids.includes(id))) return false;
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
const GROUP: Record<FilterKey, { label: string; icon: ReactNode }> = {
  posted: { label: "Date posted", icon: <CalendarPlus /> },
  postedBy: { label: "Posted by", icon: <UserRound /> },
  status: { label: "Status", icon: <CircleDot /> },
  org: { label: "Non-Profit Org.", icon: <Building2 /> },
  price: { label: "Price", icon: <CircleDollarSign /> },
  registration: { label: "Registration Type", icon: <Clipboard /> },
  eventType: { label: "Event Type", icon: <Contact /> },
  activityType: { label: "Topics", icon: <PartyPopper /> },
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
  statusOf = publishedOnly,
  showStatus = false,
}: {
  events: Event[];
  filters: HostFilters;
  onChange: (next: HostFilters) => void;
  statusOf?: StatusOf;
  /** Your Events only: All Events lists published events alone. */
  showStatus?: boolean;
}) {
  const [open, setOpen] = useState<Partial<Record<FilterKey, boolean>>>({});
  // Topic labels come from the topic list; recompute when it lands.
  const { categories } = useCategories();

  const options = useMemo(() => {
    const byKey = new Map<FilterKey, { id: string; label: string }[]>();
    for (const d of DIMENSIONS) {
      byKey.set(
        d.key,
        bucketsFor(events, d).sort((a, b) => a.label.localeCompare(b.label)),
      );
    }
    for (const k of EXTRAS) {
      const seen = new Map<string, string>();
      for (const ev of events)
        for (const b of extraBuckets(k, ev, statusOf)) seen.set(b.id, b.label);
      const list = [...seen].map(([id, label]) => ({ id, label }));
      // Dates newest first and statuses in their order; names A–Z.
      const order = ["7", "30", "90", "older", "published", "unpublished"];
      list.sort((a, b) =>
        k === "postedBy"
          ? a.label.localeCompare(b.label)
          : order.indexOf(a.id) - order.indexOf(b.id),
      );
      byKey.set(k, list);
    }
    return byKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, categories, statusOf]);

  function toggle(key: FilterKey, id: string) {
    const cur = filters[key] ?? [];
    onChange({
      ...filters,
      [key]: cur.includes(id) ? cur.filter((v) => v !== id) : [...cur, id],
    });
  }

  // The console's groups first (status, when, who), then the feed's.
  const groups: FilterKey[] = [
    ...(showStatus ? (["status"] as const) : []),
    "posted",
    "postedBy",
    ...DIMENSIONS.map((d) => d.key),
  ];
  const anyChosen = groups.some((k) => filters[k]?.length);

  return (
    <aside
      aria-label="Filter events"
      className="w-full rounded-control border border-line bg-surface px-1 py-1 lg:w-[280px] lg:shrink-0"
    >
      {groups.map((key) => {
        const d = { key };
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
              className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm text-fg hover:bg-surface-subtle"
            >
              <span aria-hidden="true" className="info-icon w-4 shrink-0 text-fg-icon [&>svg]:size-4">
                {group.icon}
              </span>
              <span className="flex-1">{group.label}</span>
              {chosen.length > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-medium text-fg">
                  {chosen.length}
                  <span className="sr-only"> selected</span>
                </span>
              )}
              <ChevronDown
                aria-hidden="true"
                className={`size-4 shrink-0 text-fg-icon transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="flex flex-col px-3 pb-2 pl-10">
                {choices.length === 0 && (
                  <p className="py-2 text-sm text-fg-muted">
                    Nothing to filter by yet.
                  </p>
                )}
                {choices.map((o) => (
                  <Checkbox
                    key={o.id}
                    label={o.label}
                    dense
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
        className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm text-fg hover:bg-surface-subtle"
      >
        <span
          aria-hidden="true"
          className="grid w-4 shrink-0 place-items-center text-fg-icon"
        >
          <span
            className={`size-3 rounded-full border-2 border-current ${
              anyChosen ? "" : "bg-current"
            }`}
          />
        </span>
        No filters
      </button>
    </aside>
  );
});
