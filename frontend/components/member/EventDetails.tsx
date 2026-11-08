import { meetingUrl } from "@/lib/place";
import type { ReactNode } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { isDerivedTag, tagIcon, tagLabel } from "@/lib/accessibility";
import type { Event } from "@/lib/api";
import { hostnameOf } from "@/lib/share";
import { EventSummary } from "@/components/ui/EventSummary";
import { Glyph } from "@/components/ui/Glyph";

// The design's LINKS box: one bordered frame, a row per link, the paperclip
// (or the file's own icon) at the row's end.
const LINK_BOX =
  "divide-y divide-line overflow-hidden rounded-control border border-line";
const LINK_ROW =
  "flex min-h-14 items-center justify-between gap-4 px-4 py-3 text-lg text-blue-700 underline underline-offset-4 hover:bg-surface-subtle";
const HEADING = "text-base font-medium uppercase tracking-wide text-fg-muted";

/** The agency's flyer: a thumbnail when it is a picture, a file icon for a PDF. */
function Poster({ url }: { url: string }) {
  const pdf = /\.pdf(\?|#|$)/i.test(url);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={LINK_ROW}>
      <span className="flex min-w-0 items-center gap-4">
        {pdf ? (
          <FileText aria-hidden="true" className="size-6 shrink-0 text-fg-icon" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="size-16 shrink-0 rounded-control border border-line-card object-cover"
          />
        )}
        <span>{pdf ? "Poster (PDF)" : "Poster"}</span>
      </span>
      <ExternalLink aria-hidden="true" className="size-6 shrink-0 text-fg-icon" />
    </a>
  );
}

/**
 * The full listing, drawn as the design's Expanded Card: the summary, the
 * tools (Share / Print) at the bottom right, beside the actions, then
 * DETAILS, POSTER and LINKS. No hooks, so the
 * server-rendered public page, the dialog over the feed and the print
 * preview all draw the same thing; each hands in its own `tools`, `going`
 * and bottom `actions`.
 */
export function EventDetails({
  event,
  going,
  tools,
  toolsFill = false,
  actions,
  hint,
  titleAs = "h2",
  titleId,
  fixedDates = false,
  insetForClose = false,
  stickyActions = false,
  saved = false,
}: {
  /** On the member's saved list: a "Saved" tag beside the title. */
  saved?: boolean;
  /** Pin the bottom buttons to the foot of the scrolling panel (the event
      panel), so they stay on screen however long the details are. */
  stickyActions?: boolean;
  event: Event;
  going?: ReactNode;
  /** Google Calendar / Share / Print, under the title and facts. */
  tools?: ReactNode;
  /** The tools take the row's room (Share filling it) and the actions keep
      their own width — a saved event's dialog. */
  toolsFill?: boolean;
  /** The bottom row; each child stretches to share the width. */
  actions?: ReactNode;
  /** A line under the actions, e.g. the host you are about to leave for. */
  hint?: string;
  titleAs?: "h1" | "h2" | "h3";
  titleId?: string;
  /** For paper: "Monday", not "Tomorrow". */
  fixedDates?: boolean;
  /**
   * Inside a dialog whose × sits in the top-right corner (until `xl`, where
   * it moves outside): keep the top row clear of it. On a phone the tags
   * are what sit there, so the room goes on the row, not on the tools.
   */
  insetForClose?: boolean;
}) {
  const meeting = meetingUrl(event);
  const links = [
    // A virtual event's meeting link comes first: it's how you get in.
    ...(meeting ? [{ label: "Join online", url: meeting }] : []),
    ...(event.links ?? []),
    // The organizer's own posting, where there is one.
    ...(event.registration_url
      ? [
          {
            label: event.requires_signup
              ? `Sign up on ${hostnameOf(event.registration_url)}`
              : `Event posting on ${hostnameOf(event.registration_url)}`,
            url: event.registration_url,
          },
        ]
      : []),
  ];

  // The same vocabulary as the member's "What you need": what this program
  // offers, so someone who needs it can see it on the listing itself. Cost
  // and drop-in are already the tags on top, so the derived ones stay off.
  const access = (event.accessibility_tags ?? []).filter((t) => !isDerivedTag(t));

  return (
    <div className="flex flex-col gap-8">
      <EventSummary
        event={event}
        layout="detail"
        saved={saved}
        headingInset={insetForClose}
        going={going}
        titleAs={titleAs}
        titleId={titleId}
        fixedDates={fixedDates}
      />

      {(event.description || event.notes) && (
        <section className="flex flex-col gap-3">
          <h3 className={HEADING}>Details</h3>
          {event.description && (
            <p className="whitespace-pre-line text-lg leading-relaxed text-fg-muted">
              {event.description}
            </p>
          )}
          {event.notes && (
            <p className="whitespace-pre-line text-lg leading-relaxed text-fg-muted">
              {event.notes}
            </p>
          )}
        </section>
      )}

      {access.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className={HEADING}>Accessibility</h3>
          <ul className="flex flex-wrap gap-3">
            {access.map((slug) => (
              <li
                key={slug}
                className="inline-flex items-center gap-2 rounded-control border border-line bg-surface-subtle px-3 py-1.5 text-lg text-fg"
              >
                <Glyph icon={tagIcon(slug)} className="text-fg-icon" />
                {tagLabel(slug)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {event.poster_url && (
        <section className="flex flex-col gap-3">
          <h3 className={HEADING}>Poster</h3>
          <div className={LINK_BOX}>
            <Poster url={event.poster_url} />
          </div>
        </section>
      )}

      {links.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className={HEADING}>Links</h3>
          {/* One card per link, two to a row at most; the whole card is
              the link, with an external-link icon at its end. */}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {links.map((link, i) => (
              <li key={`${link.url}-${i}`} className="min-w-0">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full min-h-[72px] items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 transition-[border-color,background-color,box-shadow] hover:border-fg-icon-muted hover:bg-surface-subtle/50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="break-words text-lg font-medium text-fg group-hover:underline">
                      {link.label}
                    </span>
                    <span className="truncate text-base text-fg-muted">
                      {hostnameOf(link.url)}
                    </span>
                  </span>
                  <ExternalLink aria-hidden="true" className="size-6 shrink-0 text-fg-icon" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(actions || tools) && (
        <div
          className={`flex flex-col gap-2 ${
            stickyActions
              ? // Out to the panel's sides (16 / 32px), on white with a line
                // above, stuck to the very bottom: the panel has no bottom
                // padding of its own (sticky stops above padding, and the
                // details showed through underneath), so this is its foot.
                "sticky bottom-0 z-10 -mx-4 border-t border-line bg-surface px-4 pb-6 pt-4 sm:-mx-8 sm:px-8"
              : ""
          }`}
        >
          {/* Not saved yet: Share and Print on the left (their words in line
              with the text above), Save / Register at the bottom right.
              Saved (`toolsFill`): Un-Save on the left, Print and Share at
              the right. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {actions && (
              <div
                className={`flex flex-col gap-4 sm:flex-row ${
                  toolsFill ? "" : "sm:order-2 sm:ml-auto [&>*]:max-sm:flex-1"
                }`}
              >
                {actions}
              </div>
            )}
            {tools && (
              <div
                className={`flex items-center gap-1 ${
                  toolsFill ? "min-w-0 flex-1" : "-ml-4 shrink-0 flex-wrap sm:order-1"
                }`}
              >
                {tools}
              </div>
            )}
          </div>
          {/* The destination itself is the "you are leaving" cue. */}
          {hint && <p className="text-center text-base text-fg-muted">{hint}</p>}
        </div>
      )}
    </div>
  );
}
