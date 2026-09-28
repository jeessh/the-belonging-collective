import type { ReactNode } from "react";
import { ExternalLink, FileText, Paperclip } from "lucide-react";
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

  const hold = event.capacity != null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
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
