"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArchiveX, Bookmark, CalendarPlus, MoreHorizontal, Pencil, Send } from "lucide-react";
import { TIME_ZONE } from "@/lib/time";
import type { Event } from "@/lib/api";
import { eventImage } from "@/lib/eventImage";
import { PostedBy } from "@/components/host/PostedBy";
import { savedLine } from "@/components/host/ConsoleCounts";
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

  // Edit, Share and Un-publish live in one ⋯ menu at the top right.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const away = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  const item =
    "flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-base hover:bg-surface-subtle focus-visible:bg-surface-subtle";
  const tools = (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={`More actions for ${event.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        className={TOOL}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </button>
      {menuOpen && (
        <div
          role="menu"
          aria-label={`Actions for ${event.title}`}
          className="absolute right-0 top-full z-30 mt-2 flex w-48 flex-col rounded-control border border-line bg-surface p-1 text-fg shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {canManage && (
            <Link
              role="menuitem"
              href={`/host/events/${event.id}/edit`}
              className={item}
            >
              <Pencil aria-hidden="true" className="size-4 shrink-0" />
              Edit
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setMenuOpen(false);
              setSharing(true);
            }}
          >
            <Send aria-hidden="true" className="size-4 shrink-0" />
            Share
          </button>
          {canManage && (
            <button
              type="button"
              role="menuitem"
              className={`${item} text-danger-fg hover:bg-danger focus-visible:bg-danger`}
              onClick={() => {
                setMenuOpen(false);
                onUnpublish(event);
              }}
            >
              <ArchiveX aria-hidden="true" className="size-4 shrink-0" />
              Un-publish
            </button>
          )}
        </div>
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

// The ⋯ button: small and square (36px in the console's scale, 8px corners).
const TOOL =
  "grid size-11 shrink-0 place-items-center rounded-control bg-surface-subtle text-fg-icon transition-colors hover:bg-line-active";

