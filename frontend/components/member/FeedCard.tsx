"use client";

import { memo } from "react";
import { Bookmark, BookmarkCheck, MoveRight } from "lucide-react";
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
  onSignIn,
}: {
  event: Event;
  saved: boolean;
  /** In this week's picks. */
  recommended?: boolean;
  onMoreInfo: (event: Event) => void;
  onSave: () => void;
  onSignIn: () => void;
}) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  // A phone-width column is narrower than the design's 20px labels.
  const size = "max-sm:px-4 max-sm:text-base";
  return (
    <div className="rounded-card border-2 border-line-card bg-surface p-5 sm:p-6 lg:p-8">
      <EventSummary
        event={event}
        layout="card"
        recommended={recommended}
        going={<GoingCount count={event.saved_count} onSignIn={onSignIn} />}
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
            >
              More information
            </Button>
            {saved ? (
              <Button
                variant="primary"
                size="lg"
                className={size}
                disabled
                onPointerDown={stop}
                trailingIcon={<BookmarkCheck />}
                data-tour="save"
              >
                Event saved
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
