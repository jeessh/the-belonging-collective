import { MousePointerClick } from "lucide-react";
import type { Event } from "@/lib/api";
import { GoingCount } from "@/components/ui/GoingCount";

/**
 * "N going · M clicks" on a console card or details page.
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
  const going = event.saved_count ?? 0;
  if (!going && !showClicks) return null;
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-fg ${className}`}
    >
      <GoingCount count={event.saved_count} />
      {going > 0 && showClicks && (
        <span aria-hidden="true" className="text-fg-muted">
          ·
        </span>
      )}
      {showClicks && (
        <span className="inline-flex items-center gap-3">
          <MousePointerClick
            aria-hidden="true"
            className="size-6 shrink-0 text-fg-icon"
          />
          {clicks} {clicks === 1 ? "click" : "clicks"}
        </span>
      )}
    </span>
  );
}
