"use client";

import { forwardRef, memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from "framer-motion";
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
/* The bulletin board, an experiment (the open panel's list): a cork board
   in a wooden frame, each saved program pinned to it as a miniature of the
   feed card — its picture and title — laid out two
   across, slightly askew, and free to be dragged anywhere in the box.
   Double-click opens one (Enter / Space from the keyboard). Where each
   card was left is remembered in this browser (`tbc.saved_board`). */
/* The open panel's two buttons, as sticky notes stuck to the cork: a
   strip of tape on top, a slight tilt, a curled-paper shadow. */
const STICKY =
  "relative flex min-h-[104px] flex-1 flex-col items-start justify-between gap-2 rounded-[2px] p-3 pt-4 text-left text-lg font-medium leading-tight text-[#2B2405] shadow-[0_12px_14px_-10px_rgba(40,25,5,0.55),0_2px_4px_rgba(40,25,5,0.15)] transition-transform duration-150 ease-out hover:-translate-y-1 hover:rotate-0 focus-visible:rotate-0 motion-reduce:transition-none";
const TAPE =
  "pointer-events-none absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 -rotate-3 bg-white/55 shadow-[0_1px_1px_rgba(0,0,0,0.08)]";
export const BOARD_CARD_W = 136;
const BOARD_ROW_H = 176;
const BOARD_GAP = 12;
const BOARD_PAD = 12;
const BOARD_KEY = "tbc.saved_board";
// Soft, spread-out shadows: one at rest, a deeper one while held.
const SHADOW_REST = "0 2px 4px -1px rgba(0,0,0,0.06), 0 8px 24px -6px rgba(0,0,0,0.14)";
export const SHADOW_HELD = "0 6px 12px -4px rgba(0,0,0,0.10), 0 22px 48px -10px rgba(0,0,0,0.26)";
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
 * only while empty), the
 * thumbnail column when collapsed to the rail, the thumbnail strip on the
 * bar — so the fly-to-save animation always has somewhere to aim.
 */
export const SavedSidebar = memo(
  forwardRef<HTMLDivElement, Props>(function SavedSidebar(
    {
      layout,
      onToggle,
      events,
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
            className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-control border border-dashed border-transparent px-2"
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
        open ? (
          <a href={calendarUrl} className={`${STICKY} rotate-2 bg-[#CFE6FF]`}>
            <span aria-hidden="true" className={TAPE} />
            {calendarInner}
          </a>
        ) : (
          <a href={calendarUrl} className={buttonClass("secondary", "md", RAIL)}>
            {calendarInner}
          </a>
        )
      ) : open ? (
        <button
          type="button"
          onClick={signedIn ? () => void subscribe() : onSignIn}
          className={`${STICKY} rotate-2 bg-[#CFE6FF]`}
        >
          <span aria-hidden="true" className={TAPE} />
          {calendarInner}
        </button>
      ) : (
        <Button
          variant="secondary"
          size="md"
          onClick={signedIn ? () => void subscribe() : onSignIn}
          className={RAIL}
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
            // Open, the whole panel is the cork board, in a wooden frame.
            className={`absolute inset-y-0 left-0 flex flex-col ${
              open ? "cork gap-6 border-[6px] border-[#8a5a30] pt-6" : ""
            }`}
          >
            {open ? (
              <>
                <div className="flex items-start justify-between gap-3 px-6">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-medium text-white [text-shadow:0_1px_3px_rgba(40,20,0,0.65)]">
                      Saved Events
                    </h2>
                    <p className="truncate text-xl text-fg">
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
                    // No tint while a card is dragged over: the card itself
                    // shrinks into a mini card on its way in (EventsView).
                    // The dashed outline only marks the empty drop zone; the
                    // border stays (transparent) so nothing shifts.
                    className={`relative flex min-h-0 flex-1 flex-col rounded-2xl border-2 border-dashed ${
                      events.length === 0 ? "border-fg/50" : "border-transparent"
                    }`}
                  >
                    {events.length > 0 && (
                      <div
                        className="no-scrollbar -mx-px min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
                      >
                        <Board events={events} onOpen={onOpenEvent} reduceMotion={reduceMotion} />
                      </div>
                    )}
                    {events.length === 0 && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                        <CirclePlus aria-hidden="true" className="size-10 text-fg" />
                        <p className="text-xl text-fg">Saved Events go Here</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 px-6 pb-6 pt-1">
                  <button
                    type="button"
                    onClick={onOpenSaved}
                    className={`${STICKY} -rotate-2 bg-[#FFE97A]`}
                  >
                    <span aria-hidden="true" className={TAPE} />
                    <Bookmark aria-hidden="true" className="size-6 fill-[#2B2405]" />
                    See Saved Events
                  </button>
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
                  className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3"
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
  layout: "row" | "rail";
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
  return null;
}

/** A card's place on the board, in the board's own pixels. */
type Spot = { x: number; y: number };

function readBoard(): Record<string, Spot> {
  try {
    const v = JSON.parse(localStorage.getItem(BOARD_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function writeBoard(spots: Record<string, Spot>) {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(spots));
  } catch {
    /* private window or storage off: the board just forgets */
  }
}

/** Push-pin colours; each program keeps the same one. */
const PINS = ["#e5484d", "#3b82f6", "#22a06b", "#f5b300"];

function hash(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** A small, steady tilt per program (-2.4° to 2.4°), so the board looks laid by hand. */
function tilt(id: string): number {
  return ((hash(id) % 7) - 3) * 0.8;
}

/** The open panel's saved programs, as cards to arrange freely. */
function Board({
  events,
  onOpen,
  reduceMotion,
}: {
  events: Event[];
  onOpen: (event: Event) => void;
  reduceMotion: boolean | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<Record<string, Spot>>({});
  useEffect(() => setSpots(readBoard()), []);
  // The card last picked up sits on top.
  const [top, setTop] = useState<string[]>([]);

  const slot = (i: number): Spot => ({
    x: BOARD_PAD + (i % 2) * (BOARD_CARD_W + BOARD_GAP),
    y: BOARD_PAD + Math.floor(i / 2) * BOARD_ROW_H,
  });
  // Tall enough for the starting layout and for wherever a card was left.
  const height = Math.max(
    BOARD_PAD * 2 + Math.ceil(events.length / 2) * BOARD_ROW_H,
    ...events.map((ev) => (spots[ev.id]?.y ?? 0) + BOARD_ROW_H),
  );

  const place = (id: string, spot: Spot) =>
    setSpots((prev) => {
      const next = { ...prev, [id]: spot };
      writeBoard(next);
      return next;
    });

  return (
    <div ref={ref} className="relative w-full" style={{ height, minHeight: "100%" }}>
      <AnimatePresence initial={false}>
        {events.map((ev, i) => (
          <BoardCard
            key={ev.id}
            event={ev}
            spot={spots[ev.id] ?? slot(i)}
            z={top.indexOf(ev.id) + 1}
            board={ref}
            reduceMotion={reduceMotion}
            onLift={() => setTop((t) => [...t.filter((id) => id !== ev.id), ev.id])}
            onPlace={(spot) => place(ev.id, spot)}
            onOpen={() => onOpen(ev)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function BoardCard({
  event,
  spot,
  z,
  board,
  reduceMotion,
  onLift,
  onPlace,
  onOpen,
}: {
  event: Event;
  spot: Spot;
  z: number;
  board: React.RefObject<HTMLDivElement>;
  reduceMotion: boolean | null;
  onLift: () => void;
  onPlace: (spot: Spot) => void;
  onOpen: () => void;
}) {
  // The drag moves the card by x / y; when it's let go the offset is folded
  // into its spot and x / y go back to zero.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  return (
    <motion.button
      type="button"
      drag
      dragConstraints={board}
      dragElastic={0}
      dragMomentum={false}
      onDragStart={onLift}
      onDragEnd={() => {
        onPlace({
          x: Math.max(0, spot.x + x.get()),
          y: Math.max(0, spot.y + y.get()),
        });
        x.set(0);
        y.set(0);
      }}
      onPointerDown={onLift}
      // Double-click opens it; from the keyboard, Enter or Space does.
      onDoubleClick={onOpen}
      onClick={(e) => {
        if (e.detail === 0) onOpen();
      }}
      aria-label={`${event.title}. Double-click or press Enter to open.`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, rotate: tilt(event.id), boxShadow: SHADOW_REST }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileDrag={{ scale: 1.04, rotate: 0, boxShadow: SHADOW_HELD }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      style={{ x, y, left: spot.x, top: spot.y, width: BOARD_CARD_W, zIndex: z }}
      className={`absolute cursor-grab touch-none select-none active:cursor-grabbing ${MINI_CARD}`}
    >
      {/* The push pin holding it to the cork. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-2 left-1/2 z-10 size-4 -translate-x-1/2 rounded-full shadow-[1px_2px_3px_rgba(0,0,0,0.4)]"
        style={{
          background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75) 0 2px, ${PINS[hash(event.id) % PINS.length]} 3px)`,
        }}
      />
      <MiniCardFace event={event} />
    </motion.button>
  );
}

/** The mini card's frame: white, the feed card's border, a little padding. */
export const MINI_CARD =
  "flex flex-col gap-2 rounded-card border-2 border-line-card bg-surface p-2 text-left";

/** What a mini card shows: the picture and the title. Shared with the
    feed card's drag, which turns into one on its way to the board. */
export function MiniCardFace({ event }: { event: Event }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none relative block aspect-[3/2] w-full overflow-hidden rounded-control bg-surface-subtle"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={eventImage(event)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
      <span className="line-clamp-2 px-0.5 pb-0.5 text-base font-medium leading-tight text-fg">
        {event.title}
      </span>
    </>
  );
}
