"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Search } from "lucide-react";
import type { Event, Me } from "@/lib/api";
import { oneCardPerProgram } from "@/lib/feed";
import { isUpcoming } from "@/lib/time";
import { FOCUSABLE, isTopmostDialog } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { CaregiverFeed } from "@/components/member/CaregiverFeed";
import { toastControls } from "@/components/ui/Toast";
import { BackButton } from "@/components/ui/BackButton";

const startMs = (e: Event) =>
  e.starts_at ? new Date(e.starts_at).getTime() : 0;

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
  onClose: () => void;
  onSignIn: () => void;
  onOpen: (event: Event) => void;
  /** Un-saves from a card (everything here is saved already). */
  onUnsave: (event: Event) => void;
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
  onClose,
  onSignIn,
  onOpen,
  onUnsave,
}: Props) {
  const [tab, setTab] = useState<Tab>("upcoming");
  const listHeadingRef = useRef<HTMLHeadingElement>(null);

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

  // One entry per program, at its next date — the same thing the feed shows.
  // Saving a series-priced program writes a row per date; the member's own
  // list says what they saved, not how many rows that took. Collapsed after
  // sorting, and separately per tab, so a past date never hides the
  // program's next one. Search, Filter and Sort are the list view's own.
  const { upcoming, past } = useMemo(
    () => ({
      upcoming: oneCardPerProgram(
        events.filter(isUpcoming).sort((a, b) => startMs(a) - startMs(b)),
      ),
      past: oneCardPerProgram(
        events
          .filter((e) => !isUpcoming(e))
          .sort((a, b) => startMs(b) - startMs(a)),
      ),
    }),
    [events],
  );
  const savedIds = useMemo(() => new Set(events.map((e) => e.id)), [events]);

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
      {/* The list view's conventions: the card's width (880px at most),
          centred; the heading with its count under it; search, Filter and
          Sort on one row over the same cards — which say Unsave, since
          everything here is saved. */}
      <div className="flex flex-col gap-6 p-4 [scrollbar-gutter:stable] sm:gap-8 sm:p-6 lg:px-16 lg:py-9 xl:px-24">
        {/* Back, title and the calendar / share / print buttons stay at the
            top while the list scrolls under it: on white, a line below. */}
        <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-line bg-surface px-4 pb-4 pt-4 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pb-5 sm:pt-5 lg:-mx-16 lg:-mt-9 lg:px-16 lg:pt-6 xl:-mx-24 xl:px-24">
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-3">
            <BackButton label="Back to events" onClick={onClose} />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="text-3xl font-medium text-fg lg:text-[32px]">
                  {owner ? listTitle : "All Saved Events"}
                </h1>
                <p className="text-xl text-fg-muted">
                  {me ? total : 0} Saved {(me ? total : 0) === 1 ? "Event" : "Events"}
                </p>
              </div>
              {/* Upcoming / Past, where the title's row ends. */}
              {me && (
                <SegmentedToggle
                  label="Which events"
                  className="shrink-0 self-start sm:self-auto"
                  segments={TABS}
                  value={tab}
                  onChange={setTab}
                />
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6">
          {!me ? (
            <Empty onAction={onSignIn} action="Login" />
          ) : (
            <>
              {shown.length === 0 ? (
                <Empty onAction={onClose} action="Browse Events" icon={<Search />} />
              ) : (
                <>
                  {/* The toggle already says which list this is; the heading
                      is for the keyboard and screen reader. */}
                  <h2 ref={listHeadingRef} tabIndex={-1} className="sr-only">
                    {tabLabel}
                  </h2>
                  <CaregiverFeed
                    key={tab}
                    events={shown}
                    saved={savedIds}
                    orderLabel={tab === "upcoming" ? "Soonest first" : "Most recent"}
                    removeIcon
                    onOpen={onOpen}
                    onSave={() => {}}
                    onUnsave={onUnsave}
                    onRegister={() => {}}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
});

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
