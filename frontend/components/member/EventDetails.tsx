import type { ReactNode } from "react";
import { ExternalLink, FileText, Paperclip } from "lucide-react";
import { isDerivedTag, tagEmoji, tagLabel } from "@/lib/accessibility";
import type { Event } from "@/lib/api";
import { hostnameOf } from "@/lib/share";
import { EventSummary, EventTags } from "@/components/ui/EventSummary";
import { HoldInfo } from "@/components/member/HoldInfo";

// The design's LINKS box: one bordered frame, a row per link, the paperclip
// (or the file's own icon) at the row's end.
const LINK_BOX =
  "divide-y divide-line overflow-hidden rounded-control border border-line";
const LINK_ROW =
  "flex min-h-14 items-center justify-between gap-4 px-4 py-3 text-lg text-blue-700 underline underline-offset-4 hover:bg-surface-subtle";
const HEADING = "text-base uppercase tracking-wide text-fg-muted";

/** The agency's flyer: a thumbnail when it is a picture, a file icon for a PDF. */
function Poster({ url }: { url: string }) {
  const pdf = /\.pdf(\?|#|$)/i.test(url);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={LINK_ROW}>
      <span className="flex min-w-0 items-center gap-4">
        {pdf ? (
          <FileText aria-hidden="true" className="size-8 shrink-0 text-fg-icon" />
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
 * The full listing, drawn as the design's Expanded Card: tags beside Share /
 * Print on top, then the summary, DETAILS, POSTER and LINKS. No hooks, so the
 * server-rendered public page, the dialog over the feed and the print
 * preview all draw the same thing; each hands in its own `tools`, `going`
 * and bottom `actions`.
 */
export function EventDetails({
  event,
  going,
  tools,
  actions,
  hint,
  titleAs = "h2",
  titleId,
  fixedDates = false,
  insetForClose = false,
}: {
  event: Event;
  going?: ReactNode;
  /** Share / Print, top right. */
  tools?: ReactNode;
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
  const links = [
    ...(event.links ?? []),
    // The organizer's own posting, where there is one.
    ...(event.registration_url
      ? [
          {
            label: `Event posting on ${hostnameOf(event.registration_url)}`,
            url: event.registration_url,
          },
        ]
      : []),
  ];

  // The "saving holds your spot" tip, only while there is a spot to hold.
  const hold = event.capacity != null && event.spots_left !== 0;
  // The same vocabulary as the member's "What you need": what this program
  // offers, so someone who needs it can see it on the listing itself. Cost
  // and drop-in are already the tags on top, so the derived ones stay off.
  const access = (event.accessibility_tags ?? []).filter((t) => !isDerivedTag(t));

  return (
    <div className="flex flex-col gap-8">
      <div
        className={`flex flex-wrap items-center justify-between gap-4 ${insetForClose ? "pr-12 xl:pr-0" : ""}`}
      >
        <div className="flex flex-wrap gap-3">
          <EventTags event={event} />
        </div>
        {(tools || hold) && (
          <div className="flex items-center gap-3">
            {hold && <HoldInfo />}
            {tools}
          </div>
        )}
      </div>

      <EventSummary
        event={event}
        layout="detail"
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
                <span aria-hidden="true">{tagEmoji(slug)}</span>
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
          <ul className={LINK_BOX}>
            {links.map((link, i) => (
              <li key={`${link.url}-${i}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_ROW}
                >
                  <span className="min-w-0 break-words">{link.label}</span>
                  <Paperclip
                    aria-hidden="true"
                    className="size-6 shrink-0 text-fg-icon"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {actions && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-4 sm:flex-row [&>*]:flex-1">
            {actions}
          </div>
          {/* The destination itself is the "you are leaving" cue. */}
          {hint && <p className="text-center text-base text-fg-muted">{hint}</p>}
        </div>
      )}
    </div>
  );
}
