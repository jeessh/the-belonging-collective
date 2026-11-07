import { Bookmark, MousePointerClick } from "lucide-react";
import type { Event } from "@/lib/api";

/**
 * "N people saved this event · M clicks" on a console card or details page — how many members
 * have it saved right now (`saved_count`), shown at zero too.
 *
 * Clicks are registration-link clicks — the last thing the platform sees when
 * sign-up happens on the agency's own site, and half of what goes in a grant
 * application. Shown whenever the program has a link to click, so a zero is
 * information ("nobody has followed it yet") rather than clutter.
 */
export function ConsoleCounts({
  event,
  className = "",
}: {
  event: Event;
  className?: string;
}) {
  const clicks = event.click_count;
  const showClicks = clicks != null && (clicks > 0 || !!event.registration_url);
  const saved = event.saved_count ?? 0;
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-fg ${className}`}
    >
      <span className="inline-flex items-center gap-3">
        <Bookmark aria-hidden="true" className="info-icon size-6 shrink-0 text-fg-muted" />
        {savedLine(saved)}
      </span>
      {showClicks && (
        <span aria-hidden="true" className="text-fg-muted">
          ·
        </span>
      )}
      {showClicks && (
        <span className="inline-flex items-center gap-3">
          <MousePointerClick
            aria-hidden="true"
            className="info-icon size-6 shrink-0 text-fg-icon"
          />
          {clicks} {clicks === 1 ? "click" : "clicks"}
        </span>
      )}
    </span>
  );
}

/** "3 people saved this event", "1 person saved this event". */
export function savedLine(n: number): string {
  return `${n.toLocaleString()} ${n === 1 ? "person" : "people"} saved this event`;
}
