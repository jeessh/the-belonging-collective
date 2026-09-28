"use client";

import { memo, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  MapPin,
  Pencil,
  Printer,
  Send,
  Trash2,
} from "lucide-react";
import type { Event } from "@/lib/api";
import { eventImage } from "@/lib/eventImage";
import { whenLine } from "@/lib/time";
import { useToast } from "@/components/ui/Toast";
import { EventTags } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";
import { eventUrl } from "@/components/CopyLinkButton";

/**
 * The component sheet's "Admin – Listed Event": a square image with the
 * program's tools under it, the facts beside, and a chevron to the details
 * page at the edge.
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
  onPrint,
}: {
  event: Event;
  canManage: boolean;
  onUnpublish: (event: Event) => void;
  onPrint: (event: Event) => void;
}) {
  const { show } = useToast();
  const when = whenLine(event);
  const where =
    event.location || (event.is_virtual ? "Online" : "Location to be announced");
  const clicks = event.click_count;
  const showClicks = clicks != null && (clicks > 0 || !!event.registration_url);

  async function share() {
    const url = eventUrl(event.id);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard access can be refused; the prompt keeps the URL reachable.
      window.prompt("Copy this link:", url);
      return;
    }
    show({
      title: `Link to '${event.title}' copied.`,
      description: "Paste it wherever you're sharing.",
    });
  }

  return (
    <article
      id={`event-${event.id}`}
      aria-label={event.title}
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-4 rounded-card border border-line bg-surface p-4 sm:grid-cols-[188px_minmax(0,1fr)_auto] sm:gap-x-6 sm:p-6"
    >
      {/* Image and tools: the whole width on a phone, a column from `sm`. */}
      <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
        <div className="relative aspect-[2/1] w-full overflow-hidden rounded-control bg-surface-subtle sm:aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={eventImage(event)}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="flex items-center gap-1">
          {canManage && (
            <Link
              href={`/host/events/${event.id}/edit`}
              aria-label={`Edit ${event.title}`}
              title="Edit"
              className={TOOL}
            >
              <Pencil aria-hidden="true" className="size-5" />
            </Link>
          )}
          <Tool label={`Share ${event.title}`} title="Share" onClick={() => void share()}>
            <Send aria-hidden="true" className="size-5" />
          </Tool>
          <Tool label={`Print ${event.title}`} title="Print poster" onClick={() => onPrint(event)}>
            <Printer aria-hidden="true" className="size-5" />
          </Tool>
          {canManage && (
            <>
              <span aria-hidden="true" className="mx-1 h-8 w-px bg-line" />
              <Tool
                label={`Un-publish ${event.title}`}
                title="Un-publish"
                onClick={() => onUnpublish(event)}
                className="bg-danger text-danger-fg hover:bg-danger-hover"
              >
                <Trash2 aria-hidden="true" className="size-5" />
              </Tool>
            </>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <EventTags event={event} />
        </div>
        <h3 className="text-xl font-medium leading-tight text-fg">{event.title}</h3>
        <div className="flex flex-col gap-2 text-lg text-fg-muted">
          <Fact icon={<CalendarDays />}>
            <span className="whitespace-nowrap font-medium text-fg">{when.rel}</span>
            {when.date && <span className="whitespace-nowrap"> · {when.date}</span>}
          </Fact>
          {when.time && <Fact icon={<Clock />}>{when.time}</Fact>}
          <Fact icon={<MapPin />}>{where}</Fact>
        </div>
        {/* The counts that go in a grant application, where there are any.
            Clicks are registration-link clicks; shown whenever the program
            has a link to click, so a zero is information, not clutter. */}
        {((event.saved_count ?? 0) > 0 || showClicks) && (
          <div className="flex flex-wrap gap-2">
            <GoingCount count={event.saved_count} variant="tag" />
            {showClicks && (
              <span className="inline-flex items-center rounded-control bg-surface-subtle px-3 py-1 text-sm uppercase tracking-wide text-fg-muted">
                {clicks} {clicks === 1 ? "click" : "clicks"}
              </span>
            )}
          </div>
        )}
      </div>

      <Link
        href={`/host/events/${event.id}`}
        aria-label={`View details for ${event.title}`}
        title="View details"
        className="grid size-11 place-items-center self-center rounded-full text-fg-icon hover:bg-surface-subtle"
      >
        <ChevronRight aria-hidden="true" className="size-7" />
      </Link>
    </article>
  );
});

// The sheet's small round tool button; 44px so it can be hit.
const TOOL =
  "grid size-11 shrink-0 place-items-center rounded-full bg-surface-subtle text-fg-icon transition-colors hover:bg-line-active";

function Tool({
  label,
  title,
  onClick,
  className = "",
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      className={`${TOOL} ${className}`}
    >
      {children}
    </button>
  );
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-fg-icon [&>svg]:size-6">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
