import { placeLabel } from "@/lib/place";
import type { ReactNode } from "react";
import {
  CalendarDays,
  MapPin,
} from "lucide-react";
import type { Event } from "@/lib/api";
import { eventImage } from "@/lib/eventImage";
import { whenLine } from "@/lib/time";
import { Tag, eventTags } from "@/components/ui/Tag";

/**
 * "Ages 18+", "Ages 12–17", "Up to 12"; null when the program sets no ages.
 * 99 means "no upper limit", so it reads as open. The youth flag alone draws
 * nothing on a card — it stays a console filter, not a line members read.
 */
export function ageLabel(ev: {
  min_age?: number | null;
  max_age?: number | null;
}): string | null {
  const min = ev.min_age ?? null;
  const max = ev.max_age != null && ev.max_age < 99 ? ev.max_age : null;
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  if (max != null) return `Up to ${max}`;
  return null;
}

/**
 * Who a program is for, as its card says it: "Youth · Ages 12–18", "For
 * youth", "Ages 18+", or nothing for everyone of any age. The console's
 * "Who it's for" answers (Everyone / Youth, youngest and oldest age), read
 * back to members.
 */
export function audienceLabel(ev: {
  is_youth?: boolean | null;
  min_age?: number | null;
  max_age?: number | null;
}): string | null {
  const ages = ageLabel(ev);
  if (ev.is_youth) return ages ? `Youth · ${ages}` : "For youth";
  return ages;
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
  saved = false,
  className = "",
}: {
  event: Event;
  recommended?: boolean;
  /** Unused: the "Saved" tag was taken out (the button says Unsave). */
  saved?: boolean;
  /** Passed to every pill, e.g. the feed card's larger type. */
  className?: string;
}) {
  return (
    <>
      {recommended && <Tag kind="foryou" className={className} />}
      {eventTags(event).map((kind) => (
        <Tag key={kind} kind={kind} className={className} />
      ))}
      {event.access_group && (
        <Tag
          kind="access"
          detail={event.access_group.name}
          className={className}
        />
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
 * since the same row sits in a full column and in a two-up grid. `tile` is
 * the Saved Event tile on All Saved Events: a 240px square picture beside
 * the text, no buttons.
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
  saved = false,
  fixedDates = false,
  className = "",
  aboveTitle,
}: {
  /** Above the title in the text column (the event dialog's Google
      Calendar / Share / Print). */
  aboveTitle?: ReactNode;
  event: Event;
  layout?: "card" | "detail" | "row" | "tile";
  /** The going slot — usually a `GoingCount`. */
  going?: ReactNode;
  /** Buttons, placed where the layout puts them. */
  actions?: ReactNode;
  /** The page's own heading where the summary is the page (or the dialog). */
  titleAs?: "h1" | "h2" | "h3";
  titleId?: string;
  /** "Monday" for "Tomorrow": paper and shared lists outlive today. */
  fixedDates?: boolean;
  /** In this week's picks — adds the "For you" pill. */
  recommended?: boolean;
  /** Unused: the "Saved" pill was taken out. */
  saved?: boolean;
  className?: string;
}) {
  const card = layout === "card" || layout === "detail";
  // The feed's one card, sized to the Figma frame; `short` tightens it on a
  // window too short for the frame (see tailwind.config.ts).
  const feed = layout === "card";
  const tile = layout === "tile";
  const when = whenLine(event, { fixed: fixedDates });
  const where = placeLabel(event);
  const image = eventImage(event);
  // Ages and spots left are no longer shown to members (the data stays).

  // The type scale, as drawn: the card's 24/32 over 20/24, the row's 24 over
  // 18, the saved tile's 24 over 20.
  // The feed card's facts are 20px at every size, on a 1.4 line.
  // The event's dialog and page (`detail`) use the feed card's facts too:
  // 20px text, 28px icons, so the icons match across the member app.
  const meta = feed
    ? "text-xl leading-[1.4]"
    : card
    ? "text-xl leading-[1.4]"
    : tile
      ? "text-xl"
      : "text-lg";
  // The fact icons (when, where, ages, spots) are a neutral grey: they mark
  // the facts, the words carry them.
  const icon = feed || card ? "size-7" : "size-6";

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      draggable={false}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );

  const tags = (
    <EventTags
      event={event}
      recommended={recommended}
      saved={saved}
      className={feed ? "lg:text-xl short:!text-lg" : ""}
    />
  );

  const title = (
    <Title
      id={titleId}
      className={`font-medium leading-tight text-fg ${
        feed
          ? "text-2xl sm:text-3xl lg:text-[32px] short:!text-[28px]"
          : card
            ? "text-2xl sm:text-3xl"
            : "text-2xl"
      }`}
    >
      {event.title}
    </Title>
  );

  // The title with its tags beside it (just "Free", and special access /
  // For you where they apply), on one line when there's room.
  const heading = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {title}
      {tags}
    </div>
  );

  const facts = (
    // On the feed card: 16px between facts, the date and its time 4px apart.
    <div className={`flex flex-col ${feed ? "gap-4" : "gap-3"} ${meta}`}>
      <div className="flex items-start gap-3">
        <CalendarDays
          aria-hidden="true"
          className={`mt-0.5 shrink-0 text-fg-muted ${icon}`}
        />
        <div className={`min-w-0 ${feed ? "flex flex-col gap-1" : ""}`}>
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
          className={`mt-0.5 shrink-0 text-fg-muted ${icon}`}
        />
        <p className="min-w-0 text-fg">{where}</p>
      </div>
      {/* Only three facts on any summary: when, where and the saved
          count. Cost and registration are the tags beside the title. */}
      {going && <div className={meta}>{going}</div>}
    </div>
  );

  if (tile) {
    // The Saved Event tile (All Saved Events): a square picture
    // beside the tags, title and facts, no buttons — the whole tile opens
    // the listing. The picture goes on top where the tile is narrow.
    return (
      <div className={`[container-type:inline-size] ${className}`}>
        <div className="grid gap-6 cq-md:grid-cols-[15rem_1fr]">
          <div className="relative aspect-[2/1] w-full self-start overflow-hidden rounded-control bg-surface-subtle cq-md:aspect-square">
            {img}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            {heading}
            {facts}
          </div>
        </div>
      </div>
    );
  }

  if (card) {
    const detail = layout === "detail";
    return (
      <div
        className={`flex flex-col ${feed ? "gap-4 sm:gap-6 lg:gap-8 short:!gap-5" : "gap-6"} ${className}`}
      >
        {/* Image beside the text from `sm`; on a phone it sits on top. The
            box keeps its shape (the feed card's is the frame's 324:292), and
            stretches taller when the text beside it is. */}
        <div className={`flex flex-col sm:flex-row ${feed ? "gap-4 sm:gap-6" : "gap-6"}`}>
          <div
            className={`relative w-full shrink-0 overflow-hidden rounded-control bg-surface-subtle ${
              // A wider, shorter picture on a phone feed card keeps its
              // buttons on the first screen.
              feed ? "aspect-[3/1]" : "aspect-[2/1]"
            } ${
              detail ? "sm:aspect-square sm:w-[30%]" : "sm:aspect-[324/292] sm:w-[43%]"
            }`}
          >
            {img}
          </div>
          <div className={`flex min-w-0 flex-1 flex-col ${feed ? "gap-5" : "gap-4"}`}>
            {aboveTitle}
            {heading}
            {facts}
          </div>
        </div>
        {actions && (
          // The feed card's two buttons share a row on a phone too: stacked,
          // Save started below the first screen, behind the saved bar.
          <div
            className={`flex gap-4 [&>*]:flex-1 ${feed ? "flex-row flex-wrap gap-3 sm:gap-4" : "flex-col sm:flex-row sm:flex-wrap"}`}
          >
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
          {heading}
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
