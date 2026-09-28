import type { ReactNode } from "react";
import { Cake, CalendarDays, MapPin, Ticket } from "lucide-react";
import type { Event } from "@/lib/api";
import { clockTime, whenLine } from "@/lib/time";
import { Tag, eventTags } from "@/components/ui/Tag";

/**
 * "Ages 18+", "Ages 12–17", "Up to 12", or "Youth" when only the youth flag is
 * set (the imported programs carry that and no ages); null otherwise. 99 means
 * "no upper limit", so it reads as open.
 */
export function ageLabel(ev: {
  min_age?: number | null;
  max_age?: number | null;
  is_youth?: boolean | null;
}): string | null {
  const min = ev.min_age ?? null;
  const max = ev.max_age != null && ev.max_age < 99 ? ev.max_age : null;
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  if (max != null) return `Up to ${max}`;
  return ev.is_youth ? "Youth" : null;
}

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
  titleAs: Title = "h3",
  titleId,
  recommended = false,
  className = "",
}: {
  event: Event;
  layout?: "card" | "row";
  /** The going slot — usually a `GoingCount`. */
  going?: ReactNode;
  /** Buttons, placed where the layout puts them. */
  actions?: ReactNode;
  /** The page's own heading where the summary is the page (or the dialog). */
  titleAs?: "h1" | "h2" | "h3";
  titleId?: string;
  /** In this week's picks — adds the "For you" pill. */
  recommended?: boolean;
  className?: string;
}) {
  const card = layout === "card";
  const when = whenLine(event);
  const where =
    event.location || (event.is_virtual ? "Online" : "Location to be announced");
  const image = event.cover_image_url ?? event.images[0]?.url ?? null;
  const ages = ageLabel(event);
  // The member's own hold, while it is still running.
  const held =
    event.held_until && new Date(event.held_until).getTime() > Date.now()
      ? event.held_until
      : null;

  const meta = card ? "text-xl sm:text-2xl" : "text-lg";
  const icon = card ? "size-7 sm:size-9" : "size-6";

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Image beside the text from `sm`; on a phone it sits on top. */}
      <div className="flex flex-col gap-6 sm:flex-row">
        <div
          className={`shrink-0 overflow-hidden rounded-control bg-surface-subtle ${
            card
              ? "aspect-[324/292] w-full sm:w-2/5"
              : "h-40 w-full sm:size-40"
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
            {recommended && <Tag kind="foryou" />}
            {eventTags(event).map((kind) => (
              <Tag key={kind} kind={kind} />
            ))}
            {event.access_group && (
              <Tag kind="access" detail={event.access_group.name} />
            )}
          </div>

          <Title
            id={titleId}
            className={`font-medium leading-tight text-fg ${
              card ? "text-2xl sm:text-3xl" : "text-xl"
            }`}
          >
            {event.title}
          </Title>

          <div className={`flex flex-col gap-3 ${meta}`}>
            <div className="flex items-start gap-3">
              <CalendarDays
                aria-hidden="true"
                className={`mt-0.5 shrink-0 text-fg-icon ${icon}`}
              />
              <div className="min-w-0">
                {/* Each part stays whole, so a narrow column breaks between
                    "In 52 weeks" and "· September 24, 2027", never around
                    the dot. */}
                <p className="text-fg">
                  <span className="whitespace-nowrap">{when.rel}</span>
                  {when.date && (
                    <>
                      {" "}
                      <span className="whitespace-nowrap">· {when.date}</span>
                    </>
                  )}
                </p>
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
            {ages && (
              <div className="flex items-start gap-3">
                <Cake
                  aria-hidden="true"
                  className={`mt-0.5 shrink-0 text-fg-icon ${icon}`}
                />
                <p className="min-w-0 text-fg">{ages}</p>
              </div>
            )}
            {typeof event.spots_left === "number" && (
              <div className="flex items-start gap-3">
                <Ticket
                  aria-hidden="true"
                  className={`mt-0.5 shrink-0 text-fg-icon ${icon}`}
                />
                <p className="min-w-0 text-fg">
                  {event.spots_left} {event.spots_left === 1 ? "spot" : "spots"} left
                  {held && (
                    <span className="text-fg-muted"> · Held until {clockTime(held)}</span>
                  )}
                </p>
              </div>
            )}
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
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap [&>*]:flex-1">
          {actions}
        </div>
      )}
    </div>
  );
}
