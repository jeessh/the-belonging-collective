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
  ArrowLeft,
  MoveLeft,
  MoveRight,
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
import { listShareText } from "@/lib/share";
import { FOCUSABLE, isTopmostDialog } from "@/components/Modal";
import { Button, buttonClass } from "@/components/ui/Button";
import { EventSummary } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { ShareModal } from "@/components/member/ShareModal";
import { PrintPreview } from "@/components/member/PrintPreview";
import { GoogleCalendarIcon } from "@/components/ui/GoogleCalendarIcon";
import { useToast } from "@/components/ui/Toast";

const startMs = (e: Event) =>
  e.starts_at ? new Date(e.starts_at).getTime() : 0;

const ACTION = "max-sm:min-h-11 max-sm:px-4 max-sm:text-base";

type Tab = "upcoming" | "past";
const TABS = [
  { value: "upcoming" as const, label: "Upcoming Events" },
  { value: "past" as const, label: "Past Events" },
];

// The saved list is the design's Saved Event tiles, two up, three rows to a
// page; Back / Next turn the page.
const GRID_PAGE_SIZE = 6;

type Props = {
  /** Null when signed out — there is no list to show, only a way to get one. */
  me: Me | null;
  open: boolean;
  /** Every saved row, as the feed holds it; this sorts and de-duplicates. */
  events: Event[];
  /** "Sam R." when a caregiver is looking at someone else's list. */
  owner?: string | null;
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
  calendarUrl,
  onClose,
  onSignIn,
  onOpen,
}: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("upcoming");
  const [page, setPage] = useState(1);
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
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
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
  // Clamped on read rather than in an effect, so an un-save that empties the
  // last page shows the one before it in the same render.
  const pageCount = Math.max(1, Math.ceil(shown.length / GRID_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const onPage = shown.slice(
    (current - 1) * GRID_PAGE_SIZE,
    current * GRID_PAGE_SIZE,
  );
  const tabLabel = TABS.find((t) => t.value === tab)!.label;

  function goTo(next: number) {
    setPage(next);
    // The heading sits above the cards, so the new page reads from its top.
    listHeadingRef.current?.focus();
  }
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back to events"
              className="grid size-11 shrink-0 place-items-center rounded-control text-fg hover:bg-surface-subtle"
            >
              <ArrowLeft aria-hidden="true" className="size-8" />
            </button>
            <h1 className="text-2xl font-medium text-fg sm:text-3xl">
              {owner ? listTitle : "All Saved Events"} ({me ? total : 0})
            </h1>
          </div>
        </div>

        {!me ? (
          <Empty onAction={onSignIn} action="Login" />
        ) : (
          <>
            <div className="flex flex-col gap-4 cq-xl:flex-row cq-xl:items-center cq-xl:justify-between">
              <label className="relative block w-full min-w-0 cq-xl:max-w-[640px] cq-xl:flex-1">
                <span className="sr-only">Search for event</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-fg-icon-muted"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search for event"
                  className="min-h-14 w-full rounded-control border border-line-card bg-surface-subtle py-3 pl-14 pr-4 text-lg text-fg placeholder:text-fg-muted max-sm:min-h-11"
                />
              </label>
              {/* Three of the design's large buttons are five rows on a phone;
                  the medium size there fits two to a row. */}
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
            </div>

            <SegmentedToggle
              label="Which events"
              className="self-start"
              segments={TABS}
              value={tab}
              onChange={(next) => {
                setTab(next);
                setPage(1);
              }}
            />

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
                    is for the keyboard and screen reader — it takes focus on
                    a page change and names the list. */}
                <h2
                  ref={listHeadingRef}
                  tabIndex={-1}
                  className="sr-only"
                >
                  {tabLabel}
                </h2>
                <ul className="grid gap-6 cq-xl:grid-cols-2">
                  {onPage.map((ev) => (
                    <SavedCard key={ev.id} event={ev} onOpen={onOpen} />
                  ))}
                </ul>
                {/* Pinned to the foot of the panel, so Back / Next are on
                    screen however tall the cards are. */}
                {pageCount > 1 && (
                  <nav
                    aria-label="Saved events pages"
                    className="sticky bottom-0 z-10 -mx-4 -mb-4 grid grid-cols-2 gap-4 border-t border-line bg-surface px-4 py-4 sm:-mx-6 sm:-mb-6 sm:gap-6 sm:px-6 lg:-mx-9 lg:-mb-9 lg:px-9 lg:py-6"
                  >
                    <Button
                      size="lg"
                      className={ACTION}
                      disabled={current === 1}
                      onClick={() => goTo(current - 1)}
                      leadingIcon={<MoveLeft />}
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      className={ACTION}
                      disabled={current === pageCount}
                      onClick={() => goTo(current + 1)}
                      trailingIcon={<MoveRight />}
                    >
                      Next
                    </Button>
                    <p role="status" aria-live="polite" className="sr-only">
                      Page {current} of {pageCount}
                    </p>
                  </nav>
                )}
              </>
            )}
          </>
        )}
      </div>

      {sub === "share" && (
        <ShareModal
          title="Share list of events?"
          subject={listTitle}
          body={listShareText(upcoming, window.location.origin)}
          copy={{
            label: "List",
            text: listShareText(upcoming, window.location.origin),
          }}
          // A live link to the list, as against the text above, which is a
          // snapshot. Public by design: it is only a list. The link is the
          // signed-in account's own, so it is left out of someone else's list.
          link={
            owner
              ? undefined
              : {
                  label: "Link to my list",
                  intro: "My saved programs, kept up to date:",
                  note: "Anyone with the link sees your upcoming programs.",
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
