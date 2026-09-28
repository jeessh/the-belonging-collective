import type { ReactNode } from "react";
import { Cake, CalendarDays, MapPin, Ticket } from "lucide-react";
import type { Event } from "@/lib/api";
import { eventImage } from "@/lib/eventImage";
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
 * The tag pills every surface shows for a program, in the design's order:
 * cost, registration, venue, then the special-access notice. Drawn by
 * `EventSummary`, except in the `detail` layout, where the listing puts them
 * on its own top row beside Share / Print.
 */
export function EventTags({
  event,
  recommended = false,
}: {
  event: Event;
  recommended?: boolean;
}) {
  return (
    <>
      {recommended && <Tag kind="foryou" />}
      {eventTags(event).map((kind) => (
        <Tag key={kind} kind={kind} />
      ))}
      {event.access_group && (
        <Tag kind="access" detail={event.access_group.name} />
      )}
    </>
  );
}

/**
 * The body every event surface shares: image, tags, title, when, where, and
 * whoever is going. It draws no container — the feed card, list row, saved
 * card and console card each wrap it in their own box.
 *
 * `card` is the feed's Main Card (square image beside big type). `detail` is
 * the Expanded Card — the same shape with a smaller image and no tags, since
 * the listing draws those on its top row. `row` is the Listed Event: a
 * square image that fills the row's height beside the text, stacking on top
 * of it where the row is narrow — by the row's own width, not the viewport,
 * since the same row sits in a full column and in a two-up grid. `stack` is
 * the Saved Event Card: the image bleeds to the box's edges with the tags
 * over its foot, so the box that wraps it should clip and carry no padding
 * of its own.
 *
 * Every image box is a stretched flex or grid item with an aspect ratio, so
 * it is never shorter than the text beside it, and the picture fills it.
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
  layout?: "card" | "detail" | "row" | "stack";
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
  const card = layout === "card" || layout === "detail";
  const stack = layout === "stack";
  const when = whenLine(event);
  const where =
    event.location || (event.is_virtual ? "Online" : "Location to be announced");
  const image = eventImage(event);
  const ages = ageLabel(event);
  // The member's own hold, while it is still running.
  const held =
    event.held_until && new Date(event.held_until).getTime() > Date.now()
      ? event.held_until
      : null;

  // The type scale, as drawn: the card's 24/32 over 20/24, the row's 24 over
  // 18, the saved card's 24 over 20.
  const meta = card ? "text-xl sm:text-2xl" : stack ? "text-xl" : "text-lg";
  const icon = card ? "size-7 sm:size-9" : "size-6";

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      draggable={false}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );

  const tags = <EventTags event={event} recommended={recommended} />;

  const title = (
    <Title
      id={titleId}
      className={`font-medium leading-tight text-fg ${
        card ? "text-2xl sm:text-3xl" : "text-2xl"
      } ${stack ? "line-clamp-2" : ""}`}
    >
      {event.title}
    </Title>
  );

  const facts = (
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
  );

  if (stack) {
    return (
      <div className={`flex h-full flex-col ${className}`}>
        <div className="relative aspect-[2/1] w-full shrink-0 bg-surface-subtle">
          {img}
          <div className="absolute inset-x-6 bottom-4 flex flex-wrap gap-3">
            {tags}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-6">
          {title}
          {facts}
          {actions && (
            <div className="mt-auto flex flex-wrap gap-3 pt-2 [&>*]:flex-1">
              {actions}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (card) {
    const detail = layout === "detail";
    return (
      <div className={`flex flex-col gap-6 ${className}`}>
        {/* Image beside the text from `sm`; on a phone it sits on top. The
            box is square, and stretches taller when the text beside it is. */}
        <div className="flex flex-col gap-6 sm:flex-row">
          <div
            className={`relative aspect-[2/1] w-full shrink-0 overflow-hidden rounded-control bg-surface-subtle sm:aspect-square ${
              detail ? "sm:w-[30%]" : "sm:w-2/5"
            }`}
          >
            {img}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {!detail && <div className="flex flex-wrap gap-3">{tags}</div>}
            {title}
            {facts}
          </div>
        </div>
        {actions && (
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap [&>*]:flex-1">
            {actions}
          </div>
        )}
      </div>
    );
  }

  return (
    // The query container is the wrapper: an element can't measure itself.
    <div className={`[container-type:inline-size] ${className}`}>
      {/* One column when narrow; image beside the text from `cq-sm`, with
          the buttons under both; from `cq-lg` the buttons take a third
          column at the foot of the text, so the text stays as tall as the
          image and the image — as tall as the row — comes out square. */}
      <div className="grid gap-x-6 gap-y-4 cq-sm:grid-cols-[auto_1fr] cq-lg:grid-cols-[auto_1fr_auto]">
        <div className="relative aspect-[2/1] w-full overflow-hidden rounded-control bg-surface-subtle cq-sm:aspect-auto cq-sm:min-h-44 cq-sm:w-44 cq-lg:min-h-60 cq-lg:w-60">
          {img}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap gap-3">{tags}</div>
          {title}
          {facts}
        </div>
        {actions && (
          <div className="flex flex-wrap justify-end gap-3 cq-sm:col-span-2 cq-lg:col-span-1 cq-lg:self-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
