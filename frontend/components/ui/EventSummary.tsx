import type { ReactNode } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import type { Event } from "@/lib/api";
import { whenLine } from "@/lib/time";
import { Tag, eventTags } from "@/components/ui/Tag";

/**
 * The body every event surface shares: image, tags, title, when, where, and
 * whoever is going. It draws no container — the feed card, list row, saved
 * card and console card each wrap it in their own box.
 *
 * `card` is the feed's horizontal card (big image, big type); `row` is the
 * compact shape the list rows, saved cards and console cards use.
 */
export function EventSummary({
  event,
  layout = "row",
  going,
  actions,
  className = "",
}: {
  event: Event;
  layout?: "card" | "row";
  /** The going slot — usually a `GoingCount`. */
  going?: ReactNode;
  /** Buttons, placed where the layout puts them. */
  actions?: ReactNode;
  className?: string;
}) {
  const card = layout === "card";
  const when = whenLine(event);
  const where =
    event.location || (event.is_virtual ? "Online" : "Location to be announced");
  const image = event.cover_image_url ?? event.images[0]?.url ?? null;

  const meta = card ? "text-xl sm:text-2xl" : "text-lg";
  const icon = card ? "size-7 sm:size-9" : "size-6";

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className={`flex gap-6 ${card ? "flex-col sm:flex-row" : ""}`}>
        <div
          className={`shrink-0 overflow-hidden rounded-control bg-surface-subtle ${
            card
              ? "aspect-[324/292] w-full sm:w-2/5"
              : "size-32 sm:size-40"
          }`}
        >
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              draggable={false}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            {eventTags(event).map((kind) => (
              <Tag key={kind} kind={kind} />
            ))}
          </div>

          <h3
            className={`font-medium leading-tight text-fg ${
              card ? "text-2xl sm:text-3xl" : "text-xl"
            }`}
          >
            {event.title}
          </h3>

          <div className={`flex flex-col gap-3 ${meta}`}>
            <div className="flex items-start gap-3">
              <CalendarDays
                aria-hidden="true"
                className={`mt-0.5 shrink-0 text-fg-icon ${icon}`}
              />
              <div className="min-w-0">
                <p className="text-fg">{when.day}</p>
                {when.time && <p className="text-fg-muted">{when.time}</p>}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin
                aria-hidden="true"
                className={`mt-0.5 shrink-0 text-fg-icon ${icon}`}
              />
              <p className="min-w-0 text-fg">{where}</p>
            </div>
            {going && <div className={meta}>{going}</div>}
          </div>

          {actions && !card && (
            <div className="mt-auto flex flex-wrap justify-end gap-4 pt-2">
              {actions}
            </div>
          )}
        </div>
      </div>

      {actions && card && (
        <div className="flex flex-col gap-4 sm:flex-row [&>*]:flex-1">
          {actions}
        </div>
      )}
    </div>
  );
}
