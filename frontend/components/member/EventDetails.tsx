import type { ReactNode } from "react";
import { Paperclip } from "lucide-react";
import type { Event } from "@/lib/api";
import { hostnameOf } from "@/lib/share";
import { EventSummary } from "@/components/ui/EventSummary";

/**
 * The full listing: summary, DETAILS, LINKS. No hooks, so the server-rendered
 * public page, the dialog over the feed and the print preview all draw the
 * same thing; each hands in its own `tools` (Share / Print), `going` and
 * bottom `actions`.
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

  return (
    <div className="flex flex-col gap-8">
      {tools && <div className="flex justify-end">{tools}</div>}

      <EventSummary
        event={event}
        layout="card"
        going={going}
        titleAs={titleAs}
        titleId={titleId}
      />

      {(event.description || event.notes) && (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg uppercase tracking-wide text-fg-muted">
            Details
          </h3>
          {event.description && (
            <p className="whitespace-pre-line text-lg leading-relaxed text-fg">
              {event.description}
            </p>
          )}
          {event.notes && (
            <p className="whitespace-pre-line text-lg leading-relaxed text-fg">
              {event.notes}
            </p>
          )}
        </section>
      )}

      {links.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg uppercase tracking-wide text-fg-muted">
            Links
          </h3>
          <ul className="flex flex-col gap-3">
            {links.map((link, i) => (
              <li key={`${link.url}-${i}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-14 items-center justify-between gap-4 rounded-control border border-line px-4 py-3 text-lg text-blue-700 underline underline-offset-4 hover:bg-surface-subtle"
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
