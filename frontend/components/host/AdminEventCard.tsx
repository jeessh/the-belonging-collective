"use client";

import { memo, type ReactNode } from "react";
import Link from "next/link";
import {
  ArchiveX,
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  Send,
} from "lucide-react";
import type { Event } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { eventImage } from "@/lib/eventImage";
import { whenLine } from "@/lib/time";
import { useToast } from "@/components/ui/Toast";
import { EventTags } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";
import { buttonClass } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { eventUrl } from "@/components/CopyLinkButton";

/**
 * The component sheet's "Admin – Listed Event": a square image, the facts
 * beside it, the program's tools at the top right and View more (the
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
  const { show } = useToast();
  const when = whenLine(event);
  const where =
    event.location || (event.is_virtual ? "Online" : "Location to be announced");
  const clicks = event.click_count;
  const showClicks = clicks != null && (clicks > 0 || !!event.registration_url);

  async function share() {
    const url = eventUrl(event.id);
    if (!(await copyText(url, show))) return;
    show({
      title: `Link to '${event.title}' copied.`,
      description: "Paste it wherever you're sharing.",
    });
  }

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
        tip="Copy a link to this event to share"
        align={canManage ? "center" : "end"}
        onClick={() => void share()}
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
      className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-4 rounded-card border border-line bg-surface p-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:gap-x-5 sm:p-5"
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

      {/* The tools at the top right and View more at the bottom right; on a
          phone the tools sit over the picture's corner and View more takes
          the card's last row, so the words keep the whole width. */}
      <div className="flex flex-col items-end justify-between gap-4 max-sm:contents">
        <div className="max-sm:absolute max-sm:right-6 max-sm:top-6 max-sm:rounded-full max-sm:bg-surface/90 max-sm:p-1">
          {tools}
        </div>
        <Link
          href={`/host/events/${event.id}`}
          aria-label={`View more about ${event.title}`}
          className={buttonClass("secondary", "md", "max-sm:col-span-2 max-sm:w-full")}
        >
          View more
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </article>
  );
});

// The sheet's small round tool button (36px in the console's scale).
const TOOL =
  "grid size-11 shrink-0 place-items-center rounded-full bg-surface-subtle text-fg-icon transition-colors hover:bg-line-active";

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

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-3">
      <span aria-hidden="true" className="info-icon mt-0.5 shrink-0 text-fg-icon [&>svg]:size-6">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
