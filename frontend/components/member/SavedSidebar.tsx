"use client";

import { forwardRef, memo, useCallback, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bookmark,
  ChevronsLeft,
  ChevronsRight,
  CirclePlus,
} from "lucide-react";
import { apiMessage, type Event, type GoogleCalendarState } from "@/lib/api";
import { googleCalendarButton } from "@/lib/calendar";
import { eventImage } from "@/lib/eventImage";
import { TIME_ZONE } from "@/lib/time";
import { Button, buttonClass } from "@/components/ui/Button";
import { GoogleCalendarIcon } from "@/components/ui/GoogleCalendarIcon";
import { useToast } from "@/components/ui/Toast";

/** The rail's stacked icon-over-label button. */
const RAIL = "w-full flex-col gap-1.5 px-1 py-1.5 text-sm";
const RAIL_WIDTH = 100;
/* The bookshelf, an experiment (the open panel's list): each saved program
   is a miniature of the feed card — just its picture and title — standing on a wooden plank, two to a
   shelf. Each cell draws its own piece of plank, so two side by side make
   one shelf; the cards in a row stand on its bottom edge. */
const SHELF_BACK = "flex flex-1 items-end px-3 pt-5";
const MINI_CARD =
  "flex w-full flex-col gap-2 rounded-card border-2 border-line-card bg-surface p-2 text-left shadow-[0_2px_6px_rgba(60,35,10,0.25)] transition-transform duration-200 ease-out group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5 motion-reduce:transition-none";
const PLANK =
  "block h-3.5 w-full shrink-0 bg-gradient-to-b from-[#C8996A] to-[#9E6F43] shadow-[0_4px_6px_-2px_rgba(60,35,10,0.45)]";
const PANEL_WIDTH = 377;

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
  /** The signed-in member's `Me.google_calendar`. */
  googleCalendar?: GoogleCalendarState;
  onOpenSaved: () => void;
  onOpenEvent: (event: Event) => void;
  onSignIn: () => void;
};

/**
 * Where saved programs land and where they are kept: the left column beside
 * the feed, or the bar under it on a phone.
 *
 * The forwarded ref is the drop target — the dashed zone when open (outlined
 * only while empty or while a card is dragged toward it), the
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
      googleCalendar,
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
    const { show } = useToast();
    const reduceMotion = useReducedMotion();
    // The fly-to-save target. While rail and panel cross-fade both are
    // mounted, and the one leaving would null a plain ref as it unmounts —
    // after the arriving one had set it — so a save mid-fade would have
    // nowhere to aim. This only ever points at the newest zone.
    const attachDrop = useCallback(
      (node: HTMLDivElement | null) => {
        if (!node || !dropRef) return;
        if (typeof dropRef === "function") dropRef(node);
        else dropRef.current = node;
      },
      [dropRef],
    );

    async function subscribe() {
      try {
        await googleCalendarButton(googleCalendar, show);
      } catch (err) {
        show({
          title: apiMessage(err, "Couldn't open Google Calendar."),
          tone: "alert",
        });
      }
    }

    if (layout === "bar") {
      return (
        <aside
          aria-label="Saved events"
          data-tour="saved"
          className="flex shrink-0 items-center gap-3 border-t border-line bg-surface px-4 py-2"
        >
          <div
            ref={attachDrop}
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
              <Arrivals
                events={events}
                axis="x"
                reduceMotion={reduceMotion}
                render={(ev) => <Thumb event={ev} onOpen={onOpenEvent} layout="row" />}
              />
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

    // Signed in, it puts the member's saved list in Google Calendar and keeps
    // it there (lib/calendar.googleCalendarButton); once connected it opens
    // it. That is the signed-in account's own calendar, so a caregiver
    // looking at someone else's list gets their `.ics` instead. Signed out
    // there is no list yet, so it opens sign-in.
    const calendarInner = (
      <>
        <GoogleCalendarIcon />
        {!open
          ? "Calendar"
          : owner
            ? "Download calendar"
            : googleCalendar === "connected"
              ? "Open Google Calendar"
              : "Google Calendar"}
      </>
    );
    const calendar =
      signedIn && owner ? (
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
          onClick={signedIn ? () => void subscribe() : onSignIn}
          className={open ? "w-full" : RAIL}
        >
          {calendarInner}
        </Button>
      );

    // Rail and panel are one aside whose width animates between them, so
    // opening, closing and the fold after a first save all glide. Each
    // layout sits in a layer of its own full width — the panel's content
    // never reflows at 100px — and the two cross-fade inside the clip.
    const ease = reduceMotion
      ? { duration: 0 }
      : { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const };
    return (
      <motion.aside
        aria-label="Saved events"
        data-tour="saved"
        initial={false}
        animate={{ width: open ? PANEL_WIDTH : RAIL_WIDTH }}
        transition={ease}
        className="relative shrink-0 overflow-hidden border-r border-line bg-surface"
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={open ? "panel" : "rail"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={ease}
            style={{ width: open ? PANEL_WIDTH : RAIL_WIDTH }}
            className={`absolute inset-y-0 left-0 flex flex-col ${open ? "gap-6 pt-6" : ""}`}
          >
            {open ? (
              <>
                <div className="flex items-start justify-between gap-3 px-6">
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
                    ref={attachDrop}
                    className={`relative flex min-h-0 flex-1 flex-col rounded-2xl border border-dashed transition-colors ${
                      active
                        ? "border-primary-border bg-primary-soft"
                        : events.length === 0
                          ? "border-fg-muted bg-surface"
                          : // The dashed outline only marks the empty drop zone; once
                            // there are saved events the list stands on its own. The
                            // border stays (transparent) so nothing shifts on drag.
                            "border-transparent bg-surface"
                    }`}
                  >
                    {/* The list stays mounted while a card is on its way —
                        faded under the drop message rather than swapped for
                        it — so the program that lands grows in (Arrivals)
                        instead of arriving with a rebuilt list. */}
                    {events.length > 0 && (
                      <div
                        // Out to the panel's edges (its 24px padding plus the
                        // drop zone's 1px transparent edge), so each card's
                        // hover fill runs the panel's full width; the card's
                        // own 24px padding keeps its picture and words under
                        // the "Saved Events" heading.
                        className={`-mx-[25px] grid min-h-0 flex-1 grid-cols-2 content-start overflow-y-auto transition-opacity ${
                          active ? "opacity-0" : ""
                        }`}
                      >
                        <Arrivals
                          events={events}
                          reduceMotion={reduceMotion}
                          render={(ev) => (
                            <Thumb event={ev} onOpen={onOpenEvent} layout="panel" />
                          )}
                        />
                        {/* An odd count leaves half a shelf: finish it. */}
                        {events.length % 2 === 1 && (
                          <div aria-hidden="true" className="flex h-full flex-col">
                            <span className={SHELF_BACK} />
                            <span className={PLANK} />
                          </div>
                        )}
                      </div>
                    )}
                    {(events.length === 0 || active) && (
                      <div
                        className={`flex flex-col items-center justify-center gap-3 p-6 text-center ${
                          events.length > 0 ? "absolute inset-0" : "flex-1"
                        }`}
                      >
                        <CirclePlus
                          aria-hidden="true"
                          className={`size-10 ${active ? "text-fg" : "text-fg-muted"}`}
                        />
                        <p className={`text-xl ${active ? "text-fg" : "text-fg-muted"}`}>
                          {active ? "Drag events here" : "Saved Events go Here"}
                        </p>
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
              </>
            ) : (
              <>
                <div className="p-3">
                  <Button
                    variant="secondary"
                    onClick={onToggle}
                    aria-expanded={false}
                    className={RAIL}
                  >
                    <ChevronsRight aria-hidden="true" className="size-6" />
                    Open
                  </Button>
                </div>
                <div
                  ref={attachDrop}
                  className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 transition-colors ${
                    active ? "bg-primary-soft" : ""
                  }`}
                >
                  <span className="sr-only">
                    {owner ? `${title}: ` : ""}
                    {countLabel}
                  </span>
                  <Arrivals
                    events={events}
                    reduceMotion={reduceMotion}
                    render={(ev) => (
                      <Thumb event={ev} onOpen={onOpenEvent} layout="rail" />
                    )}
                  />
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
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.aside>
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
 * A saved program arriving grows in and an un-saved one folds away, rather
 * than popping — whichever way it came: a drag, the Save button, the ← hold,
 * voice or head tracking all land in this list. Height animates too, so the
 * rest of the list slides instead of jumping. What is already there when the
 * list mounts (a reload, the rail/panel switch) stays still.
 */
function Arrivals({
  events,
  render,
  reduceMotion,
  axis = "y",
}: {
  events: Event[];
  render: (event: Event) => ReactNode;
  reduceMotion: boolean | null;
  /** `x` for the phone bar's row, which grows sideways. */
  axis?: "x" | "y";
}) {
  const shut = axis === "x" ? { width: 0 } : { height: 0 };
  const full = axis === "x" ? { width: "auto" } : { height: "auto" };
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };
  return (
    <AnimatePresence initial={false}>
      {events.map((ev) => (
        <motion.div
          key={ev.id}
          // Clipped only while it moves: at rest the thumbnail's focus ring
          // reaches past this box.
          initial={{ opacity: 0, scale: 0.9, overflow: "hidden", ...shut }}
          animate={{
            opacity: 1,
            scale: 1,
            ...full,
            transitionEnd: { overflow: "visible" },
          }}
          exit={{ opacity: 0, scale: 0.9, overflow: "hidden", ...shut }}
          transition={transition}
          className={axis === "x" ? "shrink-0" : "w-full shrink-0"}
        >
          {render(ev)}
        </motion.div>
      ))}
    </AnimatePresence>
  );
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
  // Hover (and keyboard focus) darkens the photo: the thumbnail opens.
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      draggable={false}
      className="absolute inset-0 h-full w-full object-cover transition duration-150 ease-out group-hover:brightness-75 group-focus-visible:brightness-75"
    />
  );

  if (layout === "rail") {
    return (
      <button
        type="button"
        onClick={() => onOpen(event)}
        aria-label={`Open ${event.title}`}
        className="group relative aspect-square w-full shrink-0 overflow-hidden rounded-control bg-surface-subtle"
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
        className="group flex w-48 shrink-0 items-center gap-2 rounded-control bg-surface-subtle p-1.5 text-left transition-colors duration-150 ease-out hover:bg-line-card focus-visible:bg-line-card"
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

  // The bookshelf: a miniature of the feed card standing on its shelf.
  // Hover / focus lifts it off the shelf.
  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className="group flex h-full w-full flex-col focus-visible:outline-offset-[-4px]"
    >
      <span className={SHELF_BACK}>
        <span className={MINI_CARD}>
          <span aria-hidden="true" className="relative block aspect-[3/2] w-full overflow-hidden rounded-control bg-surface-subtle">
            {img}
          </span>
          <span className="line-clamp-2 px-0.5 pb-0.5 text-base font-medium leading-tight text-fg">
            {event.title}
          </span>
        </span>
      </span>
      <span aria-hidden="true" className={PLANK} />
    </button>
  );
}
