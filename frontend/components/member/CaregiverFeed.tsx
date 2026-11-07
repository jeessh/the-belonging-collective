"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  BookX,
  CalendarDays,
  MapPin,
  MoreHorizontal,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import type { Event } from "@/lib/api";
import { googleCalendarUrl, openGoogleCalendar } from "@/lib/calendar";
import { publicEventUrl } from "@/lib/share";
import { eventImage } from "@/lib/eventImage";
import { whenLine } from "@/lib/time";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { Button } from "@/components/ui/Button";
import { GoingCount } from "@/components/ui/GoingCount";
import { EventTags } from "@/components/ui/EventSummary";
import { GoogleCalendarIcon } from "@/components/ui/GoogleCalendarIcon";
import { Modal } from "@/components/Modal";
import { SearchField } from "@/components/AdminTable";
import { ShareModal } from "@/components/member/ShareModal";
import {
  FilterPanel,
  NO_HOST_FILTERS,
  applyHostFilters,
  type HostFilters,
} from "@/components/host/PostedEvents";
import { placeLabel } from "@/lib/place";

/**
 * The Advanced experience's list (a caregiver's): the console's event
 * management layout — the filter panel on the left, search over the cards,
 * one card per event with a ⋯ menu — restricted to what a member can do.
 * Nothing here edits a program: the card opens its details, the menu
 * shares it or adds it to Google Calendar, and Save / Unsave saves for
 * whoever "Saving for" names. A special-access program the member isn't
 * approved for has no Save here; its details offer Request access.
 */
export const CaregiverFeed = memo(function CaregiverFeed({
  events,
  saved,
  onOpen,
  onSave,
  onUnsave,
}: {
  events: Event[];
  saved: Set<string>;
  onOpen: (event: Event) => void;
  onSave: (event: Event) => void;
  onUnsave: (event: Event) => void;
}) {
  const [filters, setFilters] = useState<HostFilters>(NO_HOST_FILTERS);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const wide = useMediaQuery("(min-width: 1024px)");
  const shown = useMemo(
    () => applyHostFilters(events, filters, query),
    [events, filters, query],
  );
  const chosen = Object.values(filters).reduce((n, ids) => n + (ids?.length ?? 0), 0);

  return (
    <div className="flex flex-col items-start gap-8 lg:flex-row">
      {/* Sticky: it stays in view while the cards scroll (the feed column
          is the scroller), scrolling itself if it's taller than the window. */}
      <div className="hidden w-[280px] shrink-0 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
        <FilterPanel events={events} filters={filters} onChange={setFilters} memberView />
      </div>

      <div className="flex w-full min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchField
            label="Search for event"
            placeholder="Search for event"
            value={query}
            onChange={setQuery}
            className="w-full sm:max-w-[428px]"
          />
          <Button
            className="lg:hidden"
            leadingIcon={<SlidersHorizontal />}
            aria-haspopup="dialog"
            onClick={() => setFiltersOpen(true)}
          >
            Filters{chosen > 0 && ` (${chosen})`}
          </Button>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {`${shown.length} of ${events.length} events shown`}
        </p>

        {shown.length === 0 ? (
          <p className="py-16 text-center text-2xl text-fg-muted">
            No events match these filters.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {shown.map((ev) => (
              <MemberEventCard
                key={ev.id}
                event={ev}
                saved={saved.has(ev.id)}
                onOpen={() => onOpen(ev)}
                onSave={() => onSave(ev)}
                onUnsave={() => onUnsave(ev)}
              />
            ))}
          </div>
        )}
      </div>

      {filtersOpen && !wide && (
        <Modal title="Filters" onClose={() => setFiltersOpen(false)}>
          <div className="mt-4">
            <FilterPanel events={events} filters={filters} onChange={setFilters} memberView />
          </div>
          <Button
            variant="primary"
            size="lg"
            className="mt-6 w-full"
            onClick={() => setFiltersOpen(false)}
          >
            Show {shown.length} {shown.length === 1 ? "event" : "events"}
          </Button>
        </Modal>
      )}
    </div>
  );
});

/** The console's event card, with a member's actions. */
function MemberEventCard({
  event,
  saved,
  onOpen,
  onSave,
  onUnsave,
}: {
  event: Event;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  onUnsave: () => void;
}) {
  const when = whenLine(event);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const away = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  // A special-access program needs approval before it can be saved; its
  // details say how to ask.
  const canSave = !event.access_group || event.access_status === "approved";
  const item =
    "flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-lg hover:bg-surface-subtle focus-visible:bg-surface-subtle";

  return (
    <article
      aria-label={event.title}
      className="relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-4 rounded-card border border-line bg-surface p-4 transition-[border-color,box-shadow,background-color] hover:border-fg-icon-muted hover:bg-surface-subtle/40 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] focus-within:border-fg-icon-muted sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:gap-x-6 sm:p-5"
    >
      <div className="relative col-span-2 aspect-[2/1] w-full overflow-hidden rounded-control bg-surface-subtle sm:col-span-1 sm:aspect-square">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={eventImage(event)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="col-span-2 flex min-w-0 flex-col gap-3 sm:col-span-1">
        <div className="flex flex-wrap gap-2">
          <EventTags event={event} />
        </div>
        <h3 className="text-2xl font-medium leading-tight text-fg">
          {/* The whole card opens the details: this button's ::after covers
              the card; the menu and Save sit above it. */}
          <button
            type="button"
            onClick={onOpen}
            className="text-left after:absolute after:inset-0 after:rounded-card after:content-['']"
          >
            {event.title}
          </button>
        </h3>
        <div className="flex flex-col gap-2 text-lg text-fg">
          <p className="flex items-start gap-3">
            <CalendarDays aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-fg-muted" />
            <span>
              {when.rel}
              {when.date && ` · ${when.date}`}
              {when.time && <span className="block text-fg-muted">{when.time}</span>}
            </span>
          </p>
          <p className="flex items-start gap-3">
            <MapPin aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-fg-muted" />
            {placeLabel(event)}
          </p>
          <GoingCount count={event.saved_count} />
        </div>
      </div>

      <div className="relative z-10 col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-between">
        <div ref={menuRef} className="relative max-sm:order-2">
          <button
            type="button"
            aria-label={`More actions for ${event.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="grid size-11 place-items-center rounded-control bg-surface-subtle text-fg-icon transition-colors hover:bg-line-active"
          >
            <MoreHorizontal aria-hidden="true" className="size-6" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label={`Actions for ${event.title}`}
              className="absolute right-0 top-full z-30 mt-2 flex w-64 flex-col rounded-control border border-line bg-surface p-1 text-fg shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            >
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setMenuOpen(false);
                  setSharing(true);
                }}
              >
                <Send aria-hidden="true" className="size-5 shrink-0" />
                Share
              </button>
              {googleCalendarUrl(event) !== null && (
                <button
                  type="button"
                  role="menuitem"
                  className={item}
                  onClick={() => {
                    setMenuOpen(false);
                    openGoogleCalendar(event);
                  }}
                >
                  <GoogleCalendarIcon />
                  Add to Google Calendar
                </button>
              )}
            </div>
          )}
        </div>
        {canSave &&
          (saved ? (
            <Button onClick={onUnsave} trailingIcon={<BookX />} className="max-sm:order-1 max-sm:flex-1">
              Unsave
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={onSave}
              trailingIcon={<Bookmark />}
              className="max-sm:order-1 max-sm:flex-1"
            >
              Save
            </Button>
          ))}
      </div>

      {sharing && (
        <ShareModal
          title="Share this event?"
          eventIds={[event.id]}
          link={{ getUrl: async () => publicEventUrl(event.id) }}
          onClose={() => setSharing(false)}
        />
      )}
    </article>
  );
}
