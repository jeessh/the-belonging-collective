"use client";

import { memo } from "react";
import { Bookmark, BookmarkX, MoveRight } from "lucide-react";
import type { Event } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EventSummary } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";
import { HoldInfo } from "@/components/member/HoldInfo";

/**
 * The one card on screen. The buttons stop pointer-down so pressing one is
 * never mistaken for the start of a drag.
 */
export const FeedCard = memo(function FeedCard({
  event,
  saved,
  recommended = false,
  onMoreInfo,
  onSave,
  onUnsave,
  onSignIn,
  unpinned = false,
}: {
  /** The card is on the move (dragged, held or flying to the board): its
      push pin pops off. */
  unpinned?: boolean;
  event: Event;
  saved: boolean;
  /** In this week's picks. */
  recommended?: boolean;
  onMoreInfo: (event: Event) => void;
  onSave: () => void;
  /** Saved already: take it back off the list, right here on the card. */
  onUnsave: () => void;
  onSignIn: () => void;
}) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  // A phone-width column is narrower than the design's 20px labels.
  const size = "max-sm:gap-2 max-sm:px-3 max-sm:text-base short:!min-h-12 short:!py-2";
  return (
    // Pinned to the wall like a flyer: a push pin at the top, a soft
    // shadow and the slightest tilt.
    <div className="relative -rotate-[0.5deg] rounded-card border-2 border-line-card bg-surface p-4 shadow-[0_2px_6px_-2px_rgba(60,40,15,0.12),0_14px_32px_-12px_rgba(60,40,15,0.22)] sm:p-6 lg:p-8 short:!p-6">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -top-2.5 left-1/2 z-10 size-5 -translate-x-1/2 rounded-full shadow-[1px_2px_3px_rgba(0,0,0,0.4)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
          unpinned ? "-translate-y-4 rotate-45 opacity-0" : ""
        }`}
        style={{
          background:
            "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75) 0 2px, #e5484d 3px)",
        }}
      />
      {event.capacity != null && (
        <HoldInfo className="absolute right-2 top-2 sm:right-3 sm:top-3" />
      )}
      <EventSummary
        event={event}
        layout="card"
        recommended={recommended}
        going={
          // The feed card's fact icons are 28px (EventSummary's `icon`).
          <GoingCount
            count={event.saved_count}
            onSignIn={onSignIn}
            iconClassName="size-7"
          />
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="lg"
              className={size}
              onClick={() => onMoreInfo(event)}
              onPointerDown={stop}
              trailingIcon={<MoveRight />}
              data-tour="more"
              aria-label="More information"
            >
              {/* Short on a phone, so it shares a row with Save. */}
              <span className="sm:hidden">More info</span>
              <span className="max-sm:hidden">More information</span>
            </Button>
            {saved ? (
              // Saved: the button undoes it, rather than sitting disabled —
              // a member shouldn't have to open the listing to change their
              // mind. The un-save toast offers Undo.
              <Button
                variant="secondary"
                size="lg"
                className={size}
                onClick={onUnsave}
                onPointerDown={stop}
                trailingIcon={<BookmarkX />}
                data-tour="save"
                aria-label={`Event saved. Unsave ${event.title}`}
              >
                Unsave event
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className={size}
                onClick={onSave}
                onPointerDown={stop}
                trailingIcon={<Bookmark />}
                data-tour="save"
              >
                Save event
              </Button>
            )}
          </>
        }
      />
    </div>
  );
});
