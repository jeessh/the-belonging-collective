"use client";

import { forwardRef } from "react";
import { ArrowDown, ArrowUp, Bookmark } from "lucide-react";

type Arrows = { onPrev: () => void; onNext: () => void; disabled?: boolean };

/**
 * Phone only: the pinned bottom nav, in place of the bar that used to sit
 * under the feed. A white pill holding the saved button — a round bookmark
 * with the number of saved events in a circle on its top right corner — a thin
 * divider, then the card's ↑ / ↓ (card view only). With no arrows (the list
 * view) it is just the round button, bottom right.
 *
 * The forwarded ref (on the saved button's wrapper) is the fly-to-save target
 * — EventsView's `dropRef` — so a saved card still lands on something.
 */
export const SavedFab = forwardRef<
  HTMLDivElement,
  { count: number; onOpen: () => void; arrows?: Arrows }
>(function SavedFab({ count, onOpen, arrows }, ref) {
  const label = `${count} saved ${count === 1 ? "event" : "events"}`;
  const size = arrows ? "size-12" : "size-14";

  const saved = (
    <div ref={ref} data-tour="saved" className={`relative shrink-0 ${size}`}>
      <button
        type="button"
        onClick={onOpen}
        // The count is part of the name, so a screen reader hears "3 saved
        // events" once rather than the icon and a loose number.
        aria-label={`${label}. Open saved events`}
        className={`grid ${size} place-items-center rounded-full border border-line bg-surface text-fg transition-colors hover:bg-surface-subtle active:border-primary-border active:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg`}
      >
        <Bookmark aria-hidden="true" className="size-6" />
      </button>
      {/* The primary blue disc with black digits, ringed in white so it
          reads against the button and whatever scrolls under it — a 0 too,
          so the button always says how many. Not in the accessibility
          tree: the button's name already carries the count. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-1.5 -top-1.5 grid h-7 min-w-7 place-items-center rounded-full border-2 border-surface bg-primary px-1.5 text-base font-medium leading-none text-fg"
      >
        {count > 99 ? "99+" : count}
      </span>
    </div>
  );

  if (!arrows) {
    return (
      <div
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
          right: "calc(1rem + env(safe-area-inset-right))",
        }}
        className="fixed z-30"
      >
        {saved}
      </div>
    );
  }

  const arrow =
    "grid h-12 flex-1 place-items-center rounded-xl border border-line bg-surface-subtle text-fg transition-colors hover:bg-primary-soft active:border-primary-border active:bg-primary-soft disabled:opacity-50";
  return (
    <nav
      aria-label="Saved events and event navigation"
      style={{
        bottom: "calc(0.5rem + env(safe-area-inset-bottom))",
        left: "calc(0.5rem + env(safe-area-inset-left))",
        right: "calc(0.5rem + env(safe-area-inset-right))",
      }}
      // The view toggle's treatment (white, a thin grey edge, the same
      // pressed state), with 12px above and below the buttons and a soft
      // shadow. Above the card, which scrolls under it. Corners: the
      // buttons' 8px plus the 12px of padding, so the curves run parallel.
      className="fixed z-30 flex items-center gap-3 rounded-[20px] border border-line bg-surface px-2 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.10)]"
    >
      {saved}
      {/* The design system's soft divider (the event form's rules are
          `border-line/40`). */}
      <span aria-hidden="true" className="h-8 w-px shrink-0 bg-line/40" />
      <div className="flex min-w-0 flex-1 gap-3" data-tour="arrows">
        <button
          type="button"
          aria-label="Previous event"
          onClick={arrows.onPrev}
          disabled={arrows.disabled}
          className={arrow}
        >
          <ArrowUp aria-hidden="true" className="size-6" />
        </button>
        <button
          type="button"
          aria-label="Next event"
          onClick={arrows.onNext}
          disabled={arrows.disabled}
          className={arrow}
        >
          <ArrowDown aria-hidden="true" className="size-6" />
        </button>
      </div>
    </nav>
  );
});
