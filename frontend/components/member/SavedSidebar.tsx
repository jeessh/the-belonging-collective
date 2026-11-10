"use client";

import { forwardRef, memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  ChevronsLeft,
  ChevronsRight,
  CirclePlus,
  Trash2,
} from "lucide-react";
import { apiMessage, type Event, type GoogleCalendarState } from "@/lib/api";
import { googleCalendarButton } from "@/lib/calendar";
import { eventImage } from "@/lib/eventImage";
import { TIME_ZONE } from "@/lib/time";
import { Button, buttonClass } from "@/components/ui/Button";
import { GoogleCalendarIcon } from "@/components/ui/GoogleCalendarIcon";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/Modal";

/** The rail's stacked icon-over-label button. */
const RAIL = "w-full flex-col gap-1.5 px-1 py-1.5 text-base";
const RAIL_WIDTH = 100;
/* The board, an experiment (the open panel's list): a whiteboard, each
   saved program held to it by a magnet as a miniature of the feed card —
   its picture and title — in two even columns. A click opens one. */
export const BOARD_CARD_W = 136;
// Soft, spread-out shadows: one at rest, a deeper one for the card in flight.
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
  /** Un-save, after the member drags a mini card off the open panel and
      confirms. */
  onUnsaveEvent?: (event: Event) => void;
  onSignIn: () => void;
  /** "Saving for", under the open panel's heading (a caregiver with
      linked members only). */
  careSwitcher?: ReactNode;
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
      onUnsaveEvent,
      onSignIn,
      careSwitcher = null,
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
            : // "Google Calendar" by default (signed out, or connected);
              // "Connect to Calendar" only while a signed-in member hasn't.
              signedIn && googleCalendar !== "connected"
              ? "Connect to Calendar"
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
        // One 2px grey edge on the right, open or folded; the top bar's
        // bottom line is the same grey.
        className="relative shrink-0 overflow-hidden border-r-2 border-line bg-surface"
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={open ? "panel" : "rail"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={ease}
            style={{ width: open ? PANEL_WIDTH : RAIL_WIDTH }}
            // Open, the whole panel is a whiteboard (its edge is the aside's).
            className={`absolute inset-y-0 left-0 flex flex-col ${
              open ? "whiteboard gap-6 pt-6" : ""
            }`}
          >
            {open ? (
              <>
                <div className="relative flex items-start justify-between gap-3 px-6">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-medium text-fg">
                      Saved Events
                    </h2>
                    <p className="truncate text-xl text-fg-muted">
                      {/* Just the count — "Saving for" right below already
                          says whose list it is. */}
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
                {careSwitcher && <div className="relative z-10 -mt-3 px-6">{careSwitcher}</div>}

                <div className="flex min-h-0 flex-1 flex-col px-6">
                  <div
                    ref={attachDrop}
                    // No tint while a card is dragged over: the card itself
                    // shrinks into a mini card on its way in (EventsView).
                    // The dashed outline only marks the empty drop zone; the
                    // border stays (transparent) so nothing shifts.
                    className={`relative flex min-h-0 flex-1 flex-col rounded-2xl border-2 border-dashed ${
                      events.length === 0 ? "border-line" : "border-transparent"
                    }`}
                  >
                    {events.length > 0 && (
                      <div
                        className="no-scrollbar -mx-[2px] min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
                      >
                        <Board
                          events={events}
                          onOpen={onOpenEvent}
                          onUnsave={onUnsaveEvent}
                          reduceMotion={reduceMotion}
                        />
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

                <div className="flex flex-col gap-4 px-6 pb-6 pt-1">
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
          <span className="line-clamp-2 text-base font-medium leading-snug text-fg">
            {event.title}
          </span>
          <span className="text-base text-fg-muted">{monthDay(event.starts_at)}</span>
        </span>
      </button>
    );
  }
  return null;
}

/** Where the board's own order is kept (this browser only, try/catch). */
const ORDER_KEY = "tbc.board_order";
function readOrder(): string[] {
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeOrder(ids: string[]) {
  try {
    window.localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
  } catch {
    /* private window — the order just won't outlive the page */
  }
}

/** Pixels the pointer must travel before a press becomes a drag. */
const DRAG_START = 6;
/** After a swap, the cards' layout animation runs this long; hits are
    ignored meanwhile so a card sliding away can't swap straight back. */
const SWAP_COOLDOWN = 260;

/**
 * The open panel's saved programs: two even columns of mini cards.
 *
 * Each card can be picked up: dropped on another card it takes that card's
 * place (the others slide aside as it passes over them), so the member
 * arranges the board themselves; dropped outside the panel it asks
 * "Unsave …?" first. A press without movement still opens the event.
 * The card in hand is a portalled copy, since the board's scroll box would
 * clip it at the panel's edge.
 */
function Board({
  events,
  onOpen,
  onUnsave,
  reduceMotion,
}: {
  events: Event[];
  onOpen: (event: Event) => void;
  onUnsave?: (event: Event) => void;
  reduceMotion: boolean | null;
}) {
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const };

  // Newest save first, at the top left. The list has no saved-at time, so
  // the board remembers the order cards arrived in: whatever appears that
  // wasn't there before goes in front (a whole first load keeps its own
  // order), and an un-saved card simply drops out. A member's own
  // rearranging is kept the same way, and in localStorage across reloads.
  const order = useRef<string[] | null>(null);
  if (order.current === null) order.current = typeof window === "undefined" ? [] : readOrder();
  const [, rerender] = useState(0);
  const ids = events.map((ev) => ev.id);
  const known = new Set(order.current);
  const fresh = ids.filter((id) => !known.has(id));
  const live = new Set(ids);
  order.current = [...fresh, ...order.current.filter((id) => live.has(id))];
  const byId = new Map(events.map((ev) => [ev.id, ev]));
  const shown = order.current.map((id) => byId.get(id)!).filter(Boolean);
  const orderKey = order.current.join(",");
  useEffect(() => {
    if (orderKey) writeOrder(orderKey.split(","));
  }, [orderKey]);

  const rootRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    event: Event;
    w: number;
    outside: boolean;
  } | null>(null);
  const [confirm, setConfirm] = useState<Event | null>(null);
  const ghostX = useMotionValue(0);
  const ghostY = useMotionValue(0);
  const suppressClick = useRef(false);

  function moveBefore(dragged: string, target: string) {
    const list = order.current!.filter((id) => id !== dragged);
    const from = order.current!.indexOf(dragged);
    const to = order.current!.indexOf(target);
    // Moving down the board lands after the target, up lands before it —
    // either way the dragged card ends up where the target was.
    list.splice(list.indexOf(target) + (from < to ? 1 : 0), 0, dragged);
    order.current = list;
    rerender((n) => n + 1);
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, ev: Event) {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const offX = sx - rect.left;
    const offY = sy - rect.top;
    const panel = rootRef.current?.closest("aside");
    let started = false;
    let outside = false;
    let lastSwap = 0;

    const move = (m: PointerEvent) => {
      if (!started) {
        if (Math.hypot(m.clientX - sx, m.clientY - sy) < DRAG_START) return;
        started = true;
        document.body.style.cursor = "grabbing";
        setDrag({ event: ev, w: rect.width, outside: false });
      }
      ghostX.set(m.clientX - offX);
      ghostY.set(m.clientY - offY);
      const pr = panel?.getBoundingClientRect();
      const nowOutside =
        !!pr &&
        (m.clientX < pr.left || m.clientX > pr.right || m.clientY < pr.top || m.clientY > pr.bottom);
      if (nowOutside !== outside) {
        outside = nowOutside;
        setDrag((d) => (d ? { ...d, outside } : d));
      }
      if (outside || performance.now() - lastSwap < SWAP_COOLDOWN) return;
      const hit = document
        .elementsFromPoint(m.clientX, m.clientY)
        .find((n): n is HTMLElement => n instanceof HTMLElement && !!n.dataset.boardId);
      const target = hit?.dataset.boardId;
      if (target && target !== ev.id) {
        moveBefore(ev.id, target);
        lastSwap = performance.now();
      }
    };
    const end = (cancelled: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      if (!started) return;
      document.body.style.cursor = "";
      // The click that follows a drag isn't a press on the card.
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      setDrag(null);
      if (!cancelled && outside && onUnsave) setConfirm(ev);
    };
    const up = () => end(false);
    const cancel = () => end(true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  return (
    // 16px between the cards both ways; room above each for its magnet.
    <div ref={rootRef} className="grid grid-cols-2 items-start gap-x-4 gap-y-6 pb-4 pt-4">
      <AnimatePresence initial={false}>
        {shown.map((ev) => {
          const held = drag?.event.id === ev.id;
          return (
            <motion.button
              key={ev.id}
              type="button"
              data-board-id={ev.id}
              layout={!reduceMotion}
              onPointerDown={(e) => onPointerDown(e, ev)}
              onClick={() => {
                if (!suppressClick.current) onOpen(ev);
              }}
              aria-label={`Open ${ev.title}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: held ? 0.35 : 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={transition}
              className={`relative w-full cursor-grab select-none transition-[transform,border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none ${
                held
                  ? "!border-dashed !border-fg-icon-muted"
                  : drag
                    ? ""
                    : "hover:-translate-y-1 hover:!border-fg-icon-muted hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] focus-visible:-translate-y-1 focus-visible:!border-fg-icon-muted"
              } ${MINI_CARD}`}
            >
              <MiniCardFace event={ev} />
            </motion.button>
          );
        })}
      </AnimatePresence>

      {drag &&
        typeof document !== "undefined" &&
        createPortal(
          <motion.div
            aria-hidden="true"
            className="pointer-events-none fixed left-0 top-0 z-[80]"
            style={{ x: ghostX, y: ghostY, width: drag.w }}
          >
            <motion.div
              initial={{ scale: 1, rotate: 0 }}
              animate={{
                scale: 1.05,
                rotate: drag.outside ? -4 : 2,
                opacity: drag.outside ? 0.85 : 1,
              }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}
              className={`${MINI_CARD} shadow-[0_12px_32px_rgba(0,0,0,0.18)] ${
                drag.outside ? "!border-danger-border" : ""
              }`}
            >
              <MiniCardFace event={drag.event} />
            </motion.div>
            {drag.outside && (
              <span className="mt-2 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control bg-fg px-2 py-1 text-base text-surface">
                <Trash2 aria-hidden="true" className="size-4" />
                Let go to unsave
              </span>
            )}
          </motion.div>,
          document.body,
        )}

      {confirm && (
        <UnsaveConfirm
          event={confirm}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            onUnsave?.(confirm);
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}

/** "Unsave …?" — asked when a mini card is dragged off the saved panel. */
function UnsaveConfirm({
  event,
  onConfirm,
  onClose,
}: {
  event: Event;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative z-[70]">
      <Modal title={`Unsave ${event.title}?`} onClose={onClose}>
        <p className="mt-2 text-xl leading-[1.4] text-fg-muted">
          It will come off your saved events. You can save it again from the feed.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row [&>*]:flex-1">
          <Button size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" onClick={onConfirm} trailingIcon={<Trash2 />}>
            Unsave
          </Button>
        </div>
      </Modal>
    </div>
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
      {/* Always two lines tall (clamped at two), so every card is the same
          height whatever its title. */}
      <span className="line-clamp-2 h-[2.5em] px-0.5 text-base font-medium leading-tight text-fg">
        {event.title}
      </span>
    </>
  );
}

/** Whether this browser has had the "drop it on Saved Events" tip. */
const DRAG_HINT_KEY = "tbc.drag_hint_seen";

/**
 * The first-drag tip: shown above the mini card the first time a member
 * drags an event (card or list view), then never again in this browser
 * (`tbc.drag_hint_seen`, read and written in try/catch). Call `seen()` when
 * that first drag ends.
 */
export function useDragHint(): { show: boolean; seen: () => void } {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(DRAG_HINT_KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);
  const seen = useCallback(() => {
    setShow(false);
    try {
      localStorage.setItem(DRAG_HINT_KEY, "1");
    } catch {
      /* storage off: it shows again next time, which is harmless */
    }
  }, []);
  return { show, seen };
}

/** The tip itself: a dark bubble above the dragged mini card. */
export function DragHint() {
  return (
    <span
      role="status"
      className="pointer-events-none absolute bottom-full left-1/2 mb-3 flex w-max max-w-[260px] -translate-x-1/2 items-center gap-2 rounded-control bg-fg px-3 py-2 text-base leading-snug text-surface shadow-lift"
    >
      <ArrowLeft aria-hidden="true" className="size-5 shrink-0" />
      Drop it on Saved Events, on the left, to save it
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-full -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-fg"
      />
    </span>
  );
}
