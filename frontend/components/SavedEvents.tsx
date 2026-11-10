"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BookmarkCheck, Check, ChevronDown, Printer, Search, Send } from "lucide-react";
import { createShareLink, sharedListUrl, shortName, type Event, type Me } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import type { CareChoice } from "@/components/member/FeedHeader";
import { oneCardPerProgram } from "@/lib/feed";
import { isUpcoming } from "@/lib/time";
import { FOCUSABLE, isTopmostDialog } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { CaregiverFeed, byWhen, type FeedSection } from "@/components/member/CaregiverFeed";
import { ShareModal } from "@/components/member/ShareModal";
import { PrintPreview } from "@/components/member/PrintPreview";
import { EventSummary } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";
import { toastControls } from "@/components/ui/Toast";
import { BackButton } from "@/components/ui/BackButton";

const startMs = (e: Event) =>
  e.starts_at ? new Date(e.starts_at).getTime() : 0;

const endMs = (e: Event) => {
  const at = e.ends_at ?? e.starts_at;
  return at ? new Date(at).getTime() : 0;
};
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The list view's own separators — This week, This month, Next month,
    Later — then Past (finished in the last week), folded away. */
function sections(shown: Event[]): FeedSection[] {
  return [
    ...byWhen(shown.filter(isUpcoming)),
    {
      key: "past",
      title: "Past events",
      events: shown.filter((e) => !isUpcoming(e)),
      collapsed: true,
    },
  ];
}

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
  /** A caregiver with linked members: the title becomes a menu of whose
      saved events to show (the same choice as the panel's "Saving for"). */
  care?: CareChoice | null;
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
  ownerId = null,
  care = null,
  onClose,
  onSignIn,
  onOpen,
  onUnsave,
}: Props) {
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
  // sorting, and separately for the coming and the past dates, so a past
  // date never hides the program's next one. Past events show for a week
  // after they finish, then drop off this page (the save itself is kept).
  const ordered = useMemo(() => {
    const weekAgo = Date.now() - WEEK_MS;
    const coming = oneCardPerProgram(
      events.filter(isUpcoming).sort((a, b) => startMs(a) - startMs(b)),
    );
    const past = oneCardPerProgram(
      events
        .filter((e) => !isUpcoming(e) && endMs(e) >= weekAgo)
        .sort((a, b) => startMs(b) - startMs(a)),
    );
    return [...coming, ...past];
  }, [events]);
  const savedIds = useMemo(() => new Set(events.map((e) => e.id)), [events]);
  const coming = useMemo(() => ordered.filter(isUpcoming), [ordered]);

  if (!open) return null;

  const total = oneCardPerProgram(events.filter(isUpcoming)).length;

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
        {/* Back and the title, scrolling away with the list like the feed's
            "Discover Events" heading. */}
        <div>
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-3">
            <BackButton label="Back to events" onClick={onClose} />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="flex items-center gap-3 text-3xl font-medium text-fg lg:text-[calc(2rem*var(--text-scale,1))]">
                  {/* The saved bookmark, as on the sidebar's Saved Events. */}
                  <BookmarkCheck aria-hidden="true" className="size-8 shrink-0 text-fg-icon" />
                  {care && me && care.members.length > 0 ? (
                    <WhoseList care={care} me={me} title={listTitle} />
                  ) : (
                    listTitle
                  )}
                </h1>
                <p className="text-xl text-fg-muted">
                  {me ? total : 0} Saved {(me ? total : 0) === 1 ? "Event" : "Events"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6">
          {!me ? (
            <Empty onAction={onSignIn} action="Login" />
          ) : (
            <>
              {ordered.length === 0 ? (
                <Empty onAction={onClose} action="Browse Events" icon={<Search />} />
              ) : (
                <CaregiverFeed
                  events={ordered}
                  saved={savedIds}
                  removeIcon
                  printIcon
                  savedTag={false}
                  group={sections}
                  tools={
                    // Share and Print, where the list view has Filter and
                    // Sort. Both cover the events still to come.
                    <div className="flex gap-3">
                      <Button
                        size="lg"
                        className="max-sm:flex-1"
                        leadingIcon={<Send />}
                        disabled={coming.length === 0}
                        onClick={() => setSub("share")}
                      >
                        Share
                      </Button>
                      <Button
                        size="lg"
                        className="max-sm:flex-1"
                        leadingIcon={<Printer />}
                        disabled={coming.length === 0}
                        onClick={() => setSub("print")}
                      >
                        Print
                      </Button>
                    </div>
                  }
                  onOpen={onOpen}
                  onSave={() => {}}
                  onUnsave={onUnsave}
                  onRegister={() => {}}
                />
              )}
            </>
          )}
        </div>
      </div>

      {sub === "share" && (
        <ShareModal
          title="Share list of events?"
          eventIds={coming.map((ev) => ev.id)}
          withListLink={!owner}
          forMember={ownerId}
          // Email, or a live link to the list. Public by design: it is only
          // a list. The link is the signed-in account's own, so it is left
          // out of someone else's list.
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
            {coming.map((ev) => (
              <li key={ev.id} className="py-6">
                <EventSummary
                  event={ev}
                  layout="row"
                  fixedDates
                  going={<GoingCount capacity={ev.capacity} count={ev.saved_count} />}
                />
              </li>
            ))}
          </ul>
        </PrintPreview>
      )}
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

/**
 * The saved page's title as a menu, for a caregiver: "Sam R.'s Saved
 * Events ▾", listing themselves and each member they support. Picking one
 * shows that person's list (it is the feed's "Saving for" choice, so the
 * panel follows when they go back).
 */
function WhoseList({ care, me, title }: { care: CareChoice; me: Me; title: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Close the menu, not the page under it.
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const people = [
    { id: null as string | null, label: `${me.first_name}'s Saved Events`, avatar: { name: me.first_name, src: me.avatar_url, emblem: me.avatar_emblem }, person: null },
    ...care.members.map((m) => ({
      id: m.id as string | null,
      label: `${shortName(m)}'s Saved Events`,
      avatar: { name: shortName(m), src: m.avatar_url, emblem: m.avatar_emblem },
      person: m,
    })),
  ];
  const current = care.selected?.id ?? null;

  return (
    <span ref={wrapRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="-mx-2 inline-flex min-w-0 items-center gap-2 rounded-control px-2 text-left transition-colors hover:bg-surface-subtle"
      >
        <span className="truncate">{title}</span>
        <ChevronDown aria-hidden="true" className="size-7 shrink-0 text-fg-icon" />
      </button>
      {open && (
        <span
          role="menu"
          aria-label="Whose saved events"
          className="absolute left-0 top-full z-30 mt-2 flex min-w-[300px] flex-col overflow-hidden rounded-control border border-line bg-surface py-1 shadow-lift"
        >
          {people.map((p) => {
            const on = p.id === current;
            return (
              <button
                key={p.id ?? "me"}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  setOpen(false);
                  care.onSelect(p.person);
                }}
                className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-lg font-normal text-fg transition-colors hover:bg-surface-subtle"
              >
                <Avatar name={p.avatar.name} src={p.avatar.src} emblem={p.avatar.emblem} size={28} />
                <span className="flex-1 truncate">{p.label}</span>
                {on && <Check aria-hidden="true" className="size-5" />}
              </button>
            );
          })}
        </span>
      )}
    </span>
  );
}
