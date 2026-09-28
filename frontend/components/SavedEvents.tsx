"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookmarkX,
  CalendarDays,
  MoveRight,
  Printer,
  Search,
  Send,
} from "lucide-react";
import type { Event, Me } from "@/lib/api";
import { oneCardPerProgram } from "@/lib/feed";
import { isUpcoming } from "@/lib/time";
import { savedCalendarUrl } from "@/lib/calendar";
import { listShareText } from "@/lib/share";
import { FOCUSABLE, isTopmostDialog } from "@/components/Modal";
import { Button, buttonClass } from "@/components/ui/Button";
import { EventSummary } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { ShareModal } from "@/components/member/ShareModal";
import { PrintPreview } from "@/components/member/PrintPreview";

const startMs = (e: Event) =>
  e.starts_at ? new Date(e.starts_at).getTime() : 0;

const ACTION = "max-sm:min-h-11 max-sm:px-4 max-sm:text-base";

type Tab = "upcoming" | "past";
const TABS = [
  { value: "upcoming" as const, label: "Upcoming Events" },
  { value: "past" as const, label: "Past Events" },
];

type Props = {
  /** Null when signed out — there is no list to show, only a way to get one. */
  me: Me | null;
  open: boolean;
  /** Every saved row, as the feed holds it; this sorts and de-duplicates. */
  events: Event[];
  onClose: () => void;
  onSignIn: () => void;
  onUnsave: (event: Event) => void;
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
  onClose,
  onSignIn,
  onUnsave,
  onOpen,
}: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("upcoming");
  const [sub, setSub] = useState<"share" | "print" | null>(null);

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

  // One entry per program, at its next date — the same thing the feed shows.
  // Saving a series-priced program writes a row per date; the member's own
  // list says what they saved, not how many rows that took.
  const { upcoming, past } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q
      ? events.filter((ev) =>
          [ev.title, ev.location, ev.host_name, ev.category]
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
  }, [events, query]);

  if (!open) return null;

  const shown = tab === "upcoming" ? upcoming : past;
  const total = oneCardPerProgram(events).length;
  const listTitle = me ? `${me.first_name}'s Saved Events` : "Saved Events";

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
      <div className="flex flex-col gap-8 p-4 sm:p-6 lg:p-9">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to events"
            className="grid size-11 shrink-0 place-items-center rounded-control text-fg hover:bg-surface-subtle"
          >
            <ArrowLeft aria-hidden="true" className="size-8" />
          </button>
          <h1 className="text-3xl font-medium text-fg">
            All Saved Events ({me ? total : 0})
          </h1>
        </div>

        {!me ? (
          <Empty onAction={onSignIn} action="Login" />
        ) : (
          <>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block w-full max-w-[640px]">
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
                  className="min-h-14 w-full rounded-control border border-line bg-surface py-3 pl-14 pr-4 text-lg text-fg placeholder:text-fg-muted"
                />
              </label>
              {/* Three of the design's large buttons are five rows on a phone;
                  the medium size there fits two to a row. */}
              <div className="flex flex-wrap gap-3">
                <a
                  href={savedCalendarUrl}
                  className={buttonClass("secondary", "lg", ACTION)}
                >
                  <CalendarDays
                    aria-hidden="true"
                    className="size-6 shrink-0 text-primary-border"
                  />
                  Google Calendar
                </a>
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
              segments={TABS}
              value={tab}
              onChange={setTab}
            />

            {shown.length === 0 ? (
              query ? (
                <p className="py-16 text-center text-2xl text-fg-muted">
                  Nothing matches that.
                </p>
              ) : (
                <Empty onAction={onClose} action="Browse Events" />
              )
            ) : (
              <ul className="grid gap-6 xl:grid-cols-2">
                {shown.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-card border border-line-card bg-surface p-6"
                  >
                    <EventSummary
                      event={ev}
                      layout="row"
                      going={<GoingCount count={ev.saved_count} />}
                      actions={
                        <>
                          <Button
                            onClick={() => onUnsave(ev)}
                            aria-label={`Un-save ${ev.title}`}
                            leadingIcon={<BookmarkX />}
                          >
                            Un-save
                          </Button>
                          <Button
                            onClick={() => onOpen(ev)}
                            trailingIcon={<MoveRight />}
                          >
                            More information
                          </Button>
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
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

function Empty({ action, onAction }: { action: string; onAction: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 py-24 text-center">
      <p className="text-3xl font-medium text-fg">
        You don&apos;t have any saved events yet!
      </p>
      <Button variant="primary" size="lg" className="w-full" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}
