"use client";

import { memo, useMemo, useState } from "react";
import {
  Bookmark,
  BookX,
  CalendarDays,
  MapPin,
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
import { Tooltip } from "@/components/ui/Tooltip";
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
 * one card per event — restricted to what a member can do.
 * Nothing here edits a program: the card opens its details, its icons
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <SearchField
            label="Search for event"
            placeholder="Search for event"
            value={query}
            onChange={setQuery}
            className="w-full min-w-0 sm:flex-1"
          />
          <Button
            className="shrink-0 lg:hidden"
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
  const [sharing, setSharing] = useState(false);

  // A special-access program needs approval before it can be saved; its
  // details say how to ask.
  const canSave = !event.access_group || event.access_status === "approved";
  const tool =
    "grid size-11 place-items-center rounded-control bg-surface-subtle text-fg-icon transition-colors hover:bg-line-active";

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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-2xl font-medium leading-tight text-fg">
          {/* The whole card opens the details: this button's ::after covers
              the card; the icons and Save sit above it. */}
          <button
            type="button"
            onClick={onOpen}
            className="text-left after:absolute after:inset-0 after:rounded-card after:content-['']"
          >
            {event.title}
          </button>
        </h3>
          <EventTags event={event} />
        </div>
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
        {/* Share and Google Calendar as icons, each saying what it does in
            a tooltip, then Save. */}
        <div className="flex items-center gap-2 max-sm:order-2">
          <Tooltip text="Share by email or link" align="end">
            {(tip) => (
              <button
                type="button"
                aria-label={`Share ${event.title}`}
                aria-describedby={tip}
                onClick={() => setSharing(true)}
                className={tool}
              >
                <Send aria-hidden="true" className="size-6" />
              </button>
            )}
          </Tooltip>
          {googleCalendarUrl(event) !== null && (
            <Tooltip text="Add to Google Calendar" align="end">
              {(tip) => (
                <button
                  type="button"
                  aria-label={`Add ${event.title} to Google Calendar`}
                  aria-describedby={tip}
                  onClick={() => openGoogleCalendar(event)}
                  className={tool}
                >
                  <GoogleCalendarIcon />
                </button>
              )}
            </Tooltip>
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
