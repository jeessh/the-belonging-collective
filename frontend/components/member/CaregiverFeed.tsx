"use client";

import { memo, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  Bookmark,
  BookX,
  CalendarDays,
  ClipboardPen,
  MapPin,
  Send,
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
import { SearchField } from "@/components/AdminTable";
import { ShareModal } from "@/components/member/ShareModal";
import {
  BOARD_CARD_W,
  DragHint,
  MINI_CARD,
  MiniCardFace,
  useDragHint,
} from "@/components/member/SavedSidebar";
import { NO_HOST_FILTERS, applyHostFilters } from "@/components/host/PostedEvents";
import { placeLabel } from "@/lib/place";

/**
 * The feed's List view (for everyone): search over one card per event (the
 * console's card, restricted to what a member can do), filtered by the same
 * topic / Free chips as card view, which sit over it.
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
  onRegister,
  dropTarget,
}: {
  events: Event[];
  saved: Set<string>;
  onOpen: (event: Event) => void;
  onSave: (event: Event) => void;
  onUnsave: (event: Event) => void;
  /** An event that needs registering: ask to confirm, then register. */
  onRegister: (event: Event) => void;
  /** The saved panel: dropping a dragged card on it saves the event. */
  dropTarget: RefObject<HTMLDivElement>;
}) {
  const [query, setQuery] = useState("");
  // The topic / Free chips over the list narrow `events` already; this is
  // just the search box.
  const shown = useMemo(
    () => applyHostFilters(events, NO_HOST_FILTERS, query),
    [events, query],
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <SearchField
        label="Search for event"
        placeholder="Search for event"
        value={query}
        onChange={setQuery}
        className="w-full min-w-0"
      />

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
              onRegister={() => onRegister(ev)}
              dropTarget={dropTarget}
            />
          ))}
        </div>
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
  onRegister,
  dropTarget,
}: {
  event: Event;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  onUnsave: () => void;
  onRegister: () => void;
  dropTarget: RefObject<HTMLDivElement>;
}) {
  const when = whenLine(event);
  const [sharing, setSharing] = useState(false);

  // Drag the card onto the saved panel to save it, as in card view: a mini
  // card follows the pointer while the card itself stays put (the list
  // scrolls, so it would be clipped at the column's edge, and it would
  // slide over the filter panel).
  // Not on a phone, where a finger on the list is scrolling.
  const canDragQuery = useMediaQuery("(min-width: 640px)");
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const hint = useDragHint();

  // A special-access program needs approval before it can be saved; its
  // details say how to ask.
  const canSave = !event.access_group || event.access_status === "approved";
  const draggable = canDragQuery && canSave && !saved;
  const clientPoint = (e: MouseEvent | TouchEvent | PointerEvent) =>
    "clientX" in e
      ? { x: e.clientX, y: e.clientY }
      : { x: e.changedTouches[0]?.clientX ?? 0, y: e.changedTouches[0]?.clientY ?? 0 };
  const tool =
    "grid size-11 place-items-center rounded-control bg-surface-subtle text-fg-icon transition-colors hover:bg-line-active";

  return (
    <motion.article
      aria-label={event.title}
      // The card never moves: zero constraints and no elasticity keep it in
      // place (it would slide over the filter panel), while the drag events
      // still drive the mini card that follows the pointer.
      drag={draggable}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0}
      dragMomentum={false}
      whileDrag={{ opacity: 0.6 }}
      onDragStart={() => {
        dragged.current = true;
      }}
      onDrag={(e) => setGhost(clientPoint(e))}
      onDragEnd={(e) => {
        const p = clientPoint(e);
        setGhost(null);
        hint.seen();
        const zone = dropTarget.current?.getBoundingClientRect();
        const over =
          !!zone && p.x >= zone.left && p.x <= zone.right && p.y >= zone.top && p.y <= zone.bottom;
        if (over) {
          if (event.requires_signup) onRegister();
          else onSave();
        }
        // The click that ends a drag mustn't also open the details.
        setTimeout(() => {
          dragged.current = false;
        }, 0);
      }}
      data-tour="card"
      className={`relative grid ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-4 rounded-card border border-line bg-surface p-4 transition-[border-color,box-shadow,background-color] hover:border-fg-icon-muted hover:bg-surface-subtle/40 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] focus-within:border-fg-icon-muted sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:gap-x-6 sm:p-5`}
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
            onClick={() => {
              if (!dragged.current) onOpen();
            }}
            className="text-left after:absolute after:inset-0 after:rounded-card after:content-[''] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border"
          >
            {event.title}
          </button>
        </h3>
          <EventTags event={event} saved={saved} />
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

      <div
        onPointerDownCapture={(e) => e.stopPropagation()}
        className="relative z-10 col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-between"
      >
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
          ) : event.requires_signup ? (
            <Button
              variant="primary"
              onClick={onRegister}
              trailingIcon={<ClipboardPen />}
              className="max-sm:order-1 max-sm:flex-1"
            >
              Register
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

      {ghost &&
        createPortal(
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              left: ghost.x - BOARD_CARD_W / 2,
              top: ghost.y - 60,
              width: BOARD_CARD_W,
              zIndex: 60,
              rotate: "-2deg",
            }}
            className={`pointer-events-none ${MINI_CARD}`}
          >
            {hint.show && <DragHint />}
            <MiniCardFace event={event} />
          </div>,
          document.body,
        )}
      {sharing && (
        <ShareModal
          title="Share this event?"
          eventIds={[event.id]}
          link={{ getUrl: async () => publicEventUrl(event.id) }}
          onClose={() => setSharing(false)}
        />
      )}
    </motion.article>
  );
}
