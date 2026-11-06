"use client";

import { memo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArchiveX, CalendarPlus, Pencil, Send, Bookmark } from "lucide-react";
import { TIME_ZONE } from "@/lib/time";
import type { Event } from "@/lib/api";
import { eventImage } from "@/lib/eventImage";
import { PostedBy } from "@/components/host/PostedBy";
import { savedLine } from "@/components/host/ConsoleCounts";
import { Tooltip } from "@/components/ui/Tooltip";
import { eventUrl } from "@/components/CopyLinkButton";
import { ShareModal } from "@/components/member/ShareModal";

/**
 * The component sheet's "Admin – Listed Event": a square image, the title
 * with who posted it and how many have saved it beside it, the program's tools at the top right and View more (the
 * details page) at the bottom right.
 *
 * The tools respect ownership. Edit and un-publish are only for the
 * organization that posted the program (or a superadmin); another agency's
 * program shows share and print alone, since anyone may pass a program on
 * or pin it to a noticeboard.
 */
export const AdminEventCard = memo(function AdminEventCard({
  event,
  canManage,
  onUnpublish,
}: {
  event: Event;
  canManage: boolean;
  onUnpublish: (event: Event) => void;
}) {
  const saved = event.saved_count ?? 0;

  // Share opens the members' share sheet: email or copy the link.
  const [sharing, setSharing] = useState(false);

  const tools = (
    <div className="flex items-center gap-1">
      {canManage && (
        <Tooltip text="Edit event details">
          {(tip) => (
            <Link
              href={`/host/events/${event.id}/edit`}
              aria-label={`Edit ${event.title}`}
              aria-describedby={tip}
              className={TOOL}
            >
              <Pencil aria-hidden="true" className="size-4" />
            </Link>
          )}
        </Tooltip>
      )}
      <Tool
        label={`Share ${event.title}`}
        tip="Share by email or link"
        align={canManage ? "center" : "end"}
        onClick={() => setSharing(true)}
      >
        <Send aria-hidden="true" className="size-4" />
      </Tool>
      {canManage && (
        <>
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />
          <Tool
            label={`Un-publish ${event.title}`}
            tip="Un-publish: take it off the member feed"
            align="end"
            onClick={() => onUnpublish(event)}
            className="bg-danger text-danger-fg hover:bg-danger-hover"
          >
            <ArchiveX aria-hidden="true" className="size-4" />
          </Tool>
        </>
      )}
    </div>
  );

  return (
    <article
      id={`event-${event.id}`}
      aria-label={event.title}
      className="event-card relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-4 rounded-card border border-line bg-surface p-4 transition-[border-color,box-shadow,background-color] hover:border-fg-icon-muted hover:bg-surface-subtle/40 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] focus-within:border-fg-icon-muted sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:gap-x-5 sm:p-5"
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
        <h3 className="text-2xl font-medium leading-tight text-fg">
          {/* The whole card opens the details page: this link's ::after
              covers the card, and the tools and View more sit above it. */}
          <Link
            href={`/host/events/${event.id}`}
            className="after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:outline-none"
          >
            {event.title}
          </Link>
        </h3>
        {/* Just who posted it and how many have saved it — the date, place and
            tags are on the details page (View more). */}
        <div className="flex flex-col gap-2 text-lg text-fg-muted">
          <PostedBy event={event} />
          {event.created_at && (
            <p className="flex items-center gap-3">
              <CalendarPlus aria-hidden="true" className="info-icon size-6 shrink-0 text-fg-muted" />
              Posted on{" "}
              {new Date(event.created_at).toLocaleDateString("en-CA", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: TIME_ZONE,
              })}
            </p>
          )}
          <p className="flex items-center gap-3 text-fg">
            <Bookmark aria-hidden="true" className="info-icon size-6 shrink-0 text-fg-muted" />
            {savedLine(saved)}
          </p>
        </div>
      </div>

      {/* The tools at the top right (over the picture's corner on a
          phone); the card itself is the way to the details page. */}
      <div className="relative z-10 flex flex-col items-end max-sm:contents">
        <div className="z-10 max-sm:absolute max-sm:right-6 max-sm:top-6 max-sm:rounded-control max-sm:bg-surface/90 max-sm:p-1">
          {tools}
        </div>
      </div>
      {sharing && (
        <ShareModal
          title="Share this event?"
          eventIds={[event.id]}
          organizer
          link={{ getUrl: async () => eventUrl(event.id) }}
          onClose={() => setSharing(false)}
        />
      )}
    </article>
  );
});

// The small square tool button (36px in the console's scale, 8px corners).
const TOOL =
  "grid size-11 shrink-0 place-items-center rounded-control bg-surface-subtle text-fg-icon transition-colors hover:bg-line-active";

function Tool({
  label,
  tip,
  align = "center",
  onClick,
  className = "",
  children,
}: {
  label: string;
  /** What it does, in the tooltip. */
  tip: string;
  align?: "center" | "end";
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip text={tip} align={align}>
      {(describedBy) => (
        <button
          type="button"
          aria-label={label}
          aria-describedby={describedBy}
          onClick={onClick}
          className={`${TOOL} ${className}`}
        >
          {children}
        </button>
      )}
    </Tooltip>
  );
}
