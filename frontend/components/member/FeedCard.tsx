"use client";

import { memo } from "react";
import { Bookmark, BookmarkX, ClipboardPen, MoveRight } from "lucide-react";
import type { Event } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EventSummary } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";

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
  onRegister,
}: {
  /** For an event that needs registering: the card's button says Register
      and this asks to confirm (which saves it and opens the organizer's
      page when there is one). */
  onRegister?: () => void;
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
  // The admin set "needs registration": Register (with a confirm), not Save.
  const register = !!onRegister && event.requires_signup && !saved;
  // A phone-width column is narrower than the design's 20px labels.
  const size = "max-sm:gap-2 max-sm:px-3 max-sm:text-base short:!min-h-12 short:!py-2";
  return (
    // Held up like a flyer, with a soft shadow.
    <div className="relative rounded-card border-2 border-line-card bg-surface p-4 shadow-[0_2px_6px_-2px_rgba(60,40,15,0.12),0_14px_32px_-12px_rgba(60,40,15,0.22)] sm:p-6 lg:p-8 short:!p-6">
      <EventSummary
        event={event}
        layout="card"
        recommended={recommended}
        saved={saved}
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
            {register ? (
              // Registering is asked to confirm first (RegisterConfirm);
              // confirming saves it too.
              <Button
                variant="primary"
                size="lg"
                className={size}
                onClick={onRegister}
                onPointerDown={stop}
                trailingIcon={<ClipboardPen />}
                data-tour="save"
                aria-label={`Register for ${event.title}`}
              >
                Register
              </Button>
            ) : saved ? (
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
