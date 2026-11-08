"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Printer,
  Search,
  Send,
} from "lucide-react";
import {
  apiMessage,
  createShareLink,
  sharedListUrl,
  type Event,
  type Me,
} from "@/lib/api";
import { googleCalendarButton } from "@/lib/calendar";
import { oneCardPerProgram } from "@/lib/feed";
import { useCategories } from "@/lib/useCategories";
import { isUpcoming } from "@/lib/time";
import { FOCUSABLE, isTopmostDialog } from "@/components/Modal";
import { Button, buttonClass } from "@/components/ui/Button";
import { EventSummary } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { ShareModal } from "@/components/member/ShareModal";
import { PrintPreview } from "@/components/member/PrintPreview";
import { GoogleCalendarIcon } from "@/components/ui/GoogleCalendarIcon";
import { toastControls, useToast } from "@/components/ui/Toast";
import { BackButton } from "@/components/ui/BackButton";

const startMs = (e: Event) =>
  e.starts_at ? new Date(e.starts_at).getTime() : 0;

const ACTION = "max-sm:min-h-11 max-sm:px-4 max-sm:text-base";

type Tab = "upcoming" | "past";
const TABS = [
  { value: "upcoming" as const, label: "Upcoming Events" },
  { value: "past" as const, label: "Past Events" },
];

// The saved list is the design's Saved Event tiles, two up, on one
// continuous page that scrolls.

type Props = {
  /** Null when signed out — there is no list to show, only a way to get one. */
  me: Me | null;
  open: boolean;
  /** Every saved row, as the feed holds it; this sorts and de-duplicates. */
  events: Event[];
  /** "Sam R." when a caregiver is looking at someone else's list. */
  owner?: string | null;
  /** That person's id: a share of their list is filtered by their access. */
  ownerId?: string | null;
  /** The `.ics` for whichever list is showing. */
  calendarUrl: string;
  onClose: () => void;
  onSignIn: () => void;
  onOpen: (event: Event) => void;
};

/**
 * "All Saved Events", over the feed's main column. The list is the feed's own
 * `savedEvents`, so an un-save here and an Undo on its toast both show at
 * once, without a fetch of their own.
 */
export const SavedEvents = memo(function SavedEvents({
  me,
  open,
  events,
  owner = null,
  ownerId = null,
  calendarUrl,
  onClose,
  onSignIn,
  onOpen,
}: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("upcoming");
  const [sub, setSub] = useState<"share" | "print" | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const { show } = useToast();

  async function googleCalendar() {
    try {
      await googleCalendarButton(me?.google_calendar, show);
    } catch (err) {
      show({
        title: apiMessage(err, "Couldn't open Google Calendar."),
        tone: "alert",
      });
    }
  }

  // Dialog focus management. Escape is handled globally by EventsView.
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panel) return;
      // A share sheet or print preview on top owns the keyboard while it's up.
      if (!isTopmostDialog(panel)) return;
      const items = [
        ...Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null || el === document.activeElement,
        ),
        ...toastControls(),
      ];
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || active === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const { label: topicLabel } = useCategories();

  // One entry per program, at its next date — the same thing the feed shows.
  // Saving a series-priced program writes a row per date; the member's own
  // list says what they saved, not how many rows that took.
  const { upcoming, past } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q
      ? events.filter((ev) =>
          [ev.title, ev.location, ev.host_name, topicLabel(ev.category)]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : events;
    // Collapsed after sorting, and separately per tab, so a past date never
    // hides the program's next one.
    return {
      upcoming: oneCardPerProgram(
        matching.filter(isUpcoming).sort((a, b) => startMs(a) - startMs(b)),
      ),
      past: oneCardPerProgram(
        matching
          .filter((e) => !isUpcoming(e))
          .sort((a, b) => startMs(b) - startMs(a)),
      ),
    };
  }, [events, query, topicLabel]);

  const shown = tab === "upcoming" ? upcoming : past;

  if (!open) return null;

  const total = oneCardPerProgram(events).length;
  const tabLabel = TABS.find((t) => t.value === tab)!.label;

  const listTitle = owner
    ? `${owner}'s Saved Events`
    : me
      ? `${me.first_name}'s Saved Events`
      : "Saved Events";

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      // Not "Saved events": that is the sidebar's name, and two landmarks
      // called the same thing read as one. The feed's Escape handler finds
      // the panel by this label.
      aria-label="All saved events"
      className="absolute inset-0 z-20 overflow-y-auto bg-surface outline-none"
    >
      {/* The panel shares the screen with the sidebar, so how many cards fit
          across is the panel's own width, not the viewport's. */}
      <div className="flex flex-col gap-6 p-4 [container-type:inline-size] sm:gap-8 sm:p-6 lg:p-9">
        {/* Everything above the events — back, title, search, the calendar /
            share / print buttons and the Upcoming / Past toggle — stays at
            the top while the list scrolls under it: out to the panel's
            edges, on white, with a line below. */}
        <div className="sticky top-0 z-10 -mx-4 -mt-4 flex flex-col gap-6 border-b border-line bg-surface px-4 pb-4 pt-4 sm:-mx-6 sm:-mt-6 sm:gap-8 sm:px-6 sm:pb-6 sm:pt-6 lg:-mx-9 lg:-mt-9 lg:px-9 lg:pt-9">
        {/* Row 1: back + title on the left, Google Calendar / Share /
            Print on the right. Row 2: search, with the Upcoming / Past
            toggle beside it. */}
        <div className="flex flex-col gap-4 cq-xl:flex-row cq-xl:items-end cq-xl:justify-between">
          <div className="flex min-w-0 flex-col items-start gap-2">
            <BackButton label="Back to events" onClick={onClose} />
            <h1 className="text-2xl font-medium text-fg sm:text-3xl">
              {owner ? listTitle : "All Saved Events"} ({me ? total : 0})
            </h1>
          </div>
          {/* Three of the design's large buttons are five rows on a phone;
              the medium size there fits two to a row. */}
          {me && (
              <div className="flex shrink-0 flex-wrap gap-3">
                {/* The whole list, subscribed in Google Calendar. The feed
                    is the signed-in account's own, so someone else's list
                    (a caregiver's view) stays a download. */}
                {owner ? (
                  <a
                    href={calendarUrl}
                    className={buttonClass("secondary", "lg", ACTION)}
                  >
                    <GoogleCalendarIcon />
                    Download calendar
                  </a>
                ) : (
                  <Button
                    size="lg"
                    className={ACTION}
                    onClick={() => void googleCalendar()}
                    leadingIcon={<GoogleCalendarIcon />}
                  >
                    {me?.google_calendar === "connected"
                      ? "Open Google Calendar"
                      : "Google Calendar"}
                  </Button>
                )}
                <Button
                  size="lg"
                  className={ACTION}
                  onClick={() => setSub("share")}
                  disabled={upcoming.length === 0}
                  trailingIcon={<Send />}
                >
                  Share list
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className={ACTION}
                  onClick={() => setSub("print")}
                  disabled={upcoming.length === 0}
                  trailingIcon={<Printer />}
                >
                  Print list
                </Button>
              </div>
          )}
        </div>

        {me && (
          <div className="flex flex-col gap-4 cq-xl:flex-row cq-xl:items-center">
              <label className="relative block w-full min-w-0 cq-xl:flex-1">
                <span className="sr-only">Search for event</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-fg-icon-muted"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for event"
                  className="min-h-14 w-full rounded-control border border-line-card bg-surface-subtle py-3 pl-14 pr-4 text-lg text-fg placeholder:text-fg-muted max-sm:min-h-11"
                />
              </label>
            <SegmentedToggle
              label="Which events"
              className="shrink-0 self-start cq-xl:self-auto"
              segments={TABS}
              value={tab}
              onChange={setTab}
            />
          </div>
        )}
        </div>

        {!me ? (
          <Empty onAction={onSignIn} action="Login" />
        ) : (
          <>

            {shown.length === 0 ? (
              query ? (
                <p className="py-16 text-center text-2xl text-fg-muted">
                  Nothing matches that.
                </p>
              ) : (
                <Empty
                  onAction={onClose}
                  action="Browse Events"
                  icon={<Search />}
                />
              )
            ) : (
              <>
                {/* The toggle already says which list this is; the heading
                    is for the keyboard and screen reader and names the list. */}
                <h2
                  ref={listHeadingRef}
                  tabIndex={-1}
                  className="sr-only"
                >
                  {tabLabel}
                </h2>
                <ul className="grid gap-6 cq-xl:grid-cols-2">
                  {shown.map((ev) => (
                    <SavedCard key={ev.id} event={ev} onOpen={onOpen} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {sub === "share" && (
        <ShareModal
          title="Share list of events?"
          eventIds={upcoming.map((ev) => ev.id)}
          withListLink={!owner}
          forMember={ownerId}
          // No copy-the-text row (the audit found no use for it): email, or
          // a live link to the list. Public by design: it is only a list. The
          // link is the signed-in account's own, so it is left out of
          // someone else's list.
          link={
            owner
              ? undefined
              : {
                  getUrl: async () =>
                    sharedListUrl((await createShareLink()).token),
                }
          }
          onClose={() => setSub(null)}
        />
      )}
      {sub === "print" && (
        <PrintPreview
          title={listTitle}
          printLabel="Print List"
          onClose={() => setSub(null)}
        >
          <ul className="divide-y divide-line-card">
            {upcoming.map((ev) => (
              <li key={ev.id} className="py-6">
                <EventSummary
                  event={ev}
                  layout="row"
                  fixedDates
                  going={<GoingCount count={ev.saved_count} />}
                />
              </li>
            ))}
          </ul>
        </PrintPreview>
      )}
    </div>
  );
});

/**
 * One saved program, as the design's Saved Event tile: no buttons, the tile
 * itself opens the listing (Un-save is in there). The hidden link is that
 * same door for the keyboard.
 */
function SavedCard({
  event,
  onOpen,
}: {
  event: Event;
  onOpen: (event: Event) => void;
}) {
  return (
    <li
      onClick={() => onOpen(event)}
      // Hover (and keyboard focus inside) says "this opens": the cyan
      // outline, the pale cyan fill, a soft shadow and, motion allowing, a
      // small lift.
      className="cursor-pointer overflow-hidden rounded-card border border-line-card bg-surface p-6 transition duration-150 ease-out hover:border-primary-border hover:bg-primary-soft hover:shadow-lg focus-within:border-primary-border focus-within:bg-primary-soft motion-safe:hover:-translate-y-0.5"
    >
      <EventSummary
        event={event}
        layout="tile"
        going={<GoingCount count={event.saved_count} />}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(event);
        }}
        className="sr-only focus:not-sr-only focus:mt-4 focus:inline-block focus:rounded-control focus:px-2 focus:underline"
      >
        More information about {event.title}
      </button>
    </li>
  );
}

function Empty({
  action,
  icon,
  onAction,
}: {
  action: string;
  icon?: ReactNode;
  onAction: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 py-24 text-center">
      <p className="text-3xl font-medium text-fg">
        You don&apos;t have any saved events yet!
      </p>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={onAction}
        trailingIcon={icon}
      >
        {action}
      </Button>
    </div>
  );
}
