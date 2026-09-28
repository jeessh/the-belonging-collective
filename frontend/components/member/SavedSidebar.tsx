"use client";

import { forwardRef, memo } from "react";
import {
  Bookmark,
  ChevronsLeft,
  ChevronsRight,
  CirclePlus,
} from "lucide-react";
import type { Event } from "@/lib/api";
import { eventImage } from "@/lib/eventImage";
import { TIME_ZONE, longDate } from "@/lib/time";
import { Button, buttonClass } from "@/components/ui/Button";
import { GoingCount } from "@/components/ui/GoingCount";
import { GoogleCalendarIcon } from "@/components/ui/GoogleCalendarIcon";

/** The rail's stacked icon-over-label button. */
const RAIL = "w-full flex-col gap-1 px-1 py-2 text-sm";

type Props = {
  /**
   * `panel` is the open column, `rail` the collapsed one, `bar` the strip
   * under the feed on a phone (count, thumbnails, the way to the list).
   */
  layout: "panel" | "rail" | "bar";
  onToggle: () => void;
  /** Saved programs, soonest first, one per program. */
  events: Event[];
  /** A card is being dragged (or held) toward the zone. */
  active: boolean;
  signedIn: boolean;
  /** "Sam R." when a caregiver is saving for someone; null for their own. */
  owner?: string | null;
  /** The `.ics` for whichever list is showing. */
  calendarUrl: string;
  onOpenSaved: () => void;
  onOpenEvent: (event: Event) => void;
  onSignIn: () => void;
};

/**
 * Where saved programs land and where they are kept: the left column beside
 * the feed, or the bar under it on a phone.
 *
 * The forwarded ref is the drop target — the dashed zone when open, the
 * thumbnail column when collapsed to the rail, the thumbnail strip on the
 * bar — so the fly-to-save animation always has somewhere to aim.
 */
export const SavedSidebar = memo(
  forwardRef<HTMLDivElement, Props>(function SavedSidebar(
    {
      layout,
      onToggle,
      events,
      active,
      signedIn,
      owner = null,
      calendarUrl,
      onOpenSaved,
      onOpenEvent,
      onSignIn,
    },
    dropRef,
  ) {
    const open = layout === "panel";
    const count = events.length;
    const countLabel = `${count} Saved ${count === 1 ? "Event" : "Events"}`;
    const title = owner ? `${owner}'s Saved Events` : "Saved Events";

    if (layout === "bar") {
      return (
        <aside
          aria-label="Saved events"
          data-tour="saved"
          className="flex shrink-0 items-center gap-3 border-t border-line bg-surface px-4 py-2"
        >
          <div
            ref={dropRef}
            className={`flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-control border border-dashed px-2 transition-colors ${
              active
                ? "border-primary-border bg-primary-soft"
                : "border-transparent"
            }`}
          >
            <span className="sr-only">
              {owner ? `${title}: ` : ""}
              {countLabel}
            </span>
            {/* The calendar export lives on the saved list here; the bar
                keeps to what a thumb can reach. */}
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
              {events.map((ev) => (
                <Thumb key={ev.id} event={ev} onOpen={onOpenEvent} layout="row" />
              ))}
            </div>
          </div>
          {/* The count rides on the button: a label of its own left the
              strip too narrow for one thumbnail row. */}
          <Button
            variant="secondary"
            onClick={onOpenSaved}
            leadingIcon={
              <Bookmark className="fill-primary-strong text-primary-strong" />
            }
            className="shrink-0"
          >
            {count} Saved
          </Button>
        </aside>
      );
    }

    // Signed in it is a plain link to the `.ics` (the cookie goes with it);
    // signed out there is no list to export, so it opens sign-in instead.
    const calendarInner = (
      <>
        <GoogleCalendarIcon />
        {open ? "Google Calendar" : "Calendar"}
      </>
    );
    const calendar = signedIn ? (
      <a
        href={calendarUrl}
        className={buttonClass("secondary", open ? "lg" : "md", open ? "w-full" : RAIL)}
      >
        {calendarInner}
      </a>
    ) : (
      <Button
        variant="secondary"
        size={open ? "lg" : "md"}
        onClick={onSignIn}
        className={open ? "w-full" : RAIL}
      >
        {calendarInner}
      </Button>
    );

    if (!open) {
      return (
        <aside
          aria-label="Saved events"
          data-tour="saved"
          className="flex w-[100px] shrink-0 flex-col border-r border-line bg-surface"
        >
          <div className="p-3">
            <Button
              variant="secondary"
              onClick={onToggle}
              aria-expanded={false}
              className={RAIL}
            >
              <ChevronsRight aria-hidden="true" className="size-7" />
              Open
            </Button>
          </div>
          <div
            ref={dropRef}
            className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 transition-colors ${
              active ? "bg-primary-soft" : ""
            }`}
          >
            <span className="sr-only">
              {owner ? `${title}: ` : ""}
              {countLabel}
            </span>
            {events.map((ev) => (
              <Thumb key={ev.id} event={ev} onOpen={onOpenEvent} layout="rail" />
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-line p-3">
            <Button
              variant="secondary"
              onClick={onOpenSaved}
              className={RAIL}
            >
              <Bookmark aria-hidden="true" className="size-6 fill-primary-strong text-primary-strong" />
              Events
            </Button>
            {calendar}
          </div>
        </aside>
      );
    }

    return (
      <aside
        aria-label="Saved events"
        data-tour="saved"
        className="flex w-[377px] shrink-0 flex-col gap-6 border-r border-line bg-surface pt-6"
      >
        <div className="flex items-center justify-between gap-3 px-6">
          <div className="min-w-0">
            <h2 className="text-2xl font-medium text-fg">Saved Events</h2>
            <p className="truncate text-xl text-fg-muted">
              {owner ? `For ${owner} · ` : ""}
              {countLabel}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={onToggle}
            aria-expanded
            aria-label="Close saved events sidebar"
            leadingIcon={<ChevronsLeft />}
            className="pl-3"
          >
            Close
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-6">
          <div
            ref={dropRef}
            className={`flex min-h-0 flex-1 flex-col rounded-2xl border border-dashed transition-colors ${
              active
                ? "border-primary-border bg-primary-soft"
                : "border-fg-muted bg-surface"
            }`}
          >
            {events.length === 0 || active ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <CirclePlus
                  aria-hidden="true"
                  className={`size-10 ${active ? "text-fg" : "text-fg-muted"}`}
                />
                <p className={`text-xl ${active ? "text-fg" : "text-fg-muted"}`}>
                  {active ? "Drag events here" : "Saved Events go Here"}
                </p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
                {events.map((ev) => (
                  <Thumb key={ev.id} event={ev} onOpen={onOpenEvent} layout="panel" />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line px-6 py-4">
          <Button
            variant="secondary"
            size="lg"
            onClick={onOpenSaved}
            leadingIcon={<Bookmark className="fill-primary-strong text-primary-strong" />}
            className="w-full"
          >
            See Saved Events
          </Button>
          {calendar}
        </div>
      </aside>
    );
  }),
);

/** "October 24" — the compact thumbnail's date, as the design shortens it. */
function monthDay(iso?: string | null): string {
  if (!iso) return "Date to be announced";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "Date to be announced";
  return at.toLocaleDateString("en-CA", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric",
  });
}

/**
 * A saved program, as the design's Event Thumbnail. Opens the full listing.
 *
 * `panel` is the large one: the photo over the title and date. `row` is the
 * compact one on the phone's bar: photo, title and date side by side on a
 * grey tile. `rail` is the photo alone, which is all a 100px column has
 * room for; the title is the accessible name.
 */
function Thumb({
  event,
  onOpen,
  layout,
}: {
  event: Event;
  onOpen: (event: Event) => void;
  layout: "panel" | "row" | "rail";
}) {
  const image = eventImage(event);
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      draggable={false}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
  const going = <GoingCount count={event.saved_count} variant="tag" />;

  if (layout === "rail") {
    return (
      <button
        type="button"
        onClick={() => onOpen(event)}
        aria-label={`Open ${event.title}`}
        className="relative aspect-square w-full shrink-0 overflow-hidden rounded-control bg-surface-subtle"
      >
        {img}
      </button>
    );
  }

  if (layout === "row") {
    return (
      <button
        type="button"
        onClick={() => onOpen(event)}
        className="flex w-48 shrink-0 items-center gap-2 rounded-control bg-surface-subtle p-1.5 text-left"
      >
        <span
          aria-hidden="true"
          className="relative size-14 shrink-0 overflow-hidden rounded-control"
        >
          {img}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 text-sm font-medium leading-snug text-fg">
            {event.title}
          </span>
          <span className="text-xs text-fg-muted">{monthDay(event.starts_at)}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className="flex w-full shrink-0 flex-col gap-2 rounded-control text-left"
    >
      <span
        aria-hidden="true"
        className="relative block h-[150px] w-full overflow-hidden rounded-control bg-surface-subtle"
      >
        {img}
      </span>
      <span className="flex flex-col items-start gap-1">
        <span className="text-lg font-medium leading-snug text-fg">
          {event.title}
        </span>
        <span className="text-base text-fg-muted">
          {longDate(event.starts_at) || "Date to be announced"}
        </span>
        {going}
      </span>
    </button>
  );
}
