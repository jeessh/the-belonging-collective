"use client";

import { memo, useState } from "react";
import { Bookmark, ClipboardPen, MoveRight, Send } from "lucide-react";
import { publicEventUrl } from "@/lib/share";
import { ShareModal } from "@/components/member/ShareModal";
import { WaitlistAction, waitlistState } from "@/components/member/WaitlistAction";
import type { Event } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EventSummary } from "@/components/ui/EventSummary";

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
  onJoinWaitlist,
  onLeaveWaitlist,
  preview = false,
  actionsBelow = false,
  moreLast = false,
}: {
  /** The buttons drawn under the deck, not in the card (no longer used on a
      phone: Save is in the card). */
  actionsBelow?: boolean;
  /** On a phone: Save / Register first and "More info" after it, as the
      secondary button on the right (it is first on a wider screen). */
  moreLast?: boolean;
  /** A look-only copy (the deck's next card): no tour target. */
  preview?: boolean;
  /** A full program: join, or leave, its waitlist (WaitlistAction). */
  onJoinWaitlist?: () => void;
  onLeaveWaitlist?: () => void;
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
  return (
    <div data-tour={preview ? undefined : "card"} className="relative rounded-card border-2 border-line-card bg-surface p-4 max-sm:p-3 sm:p-6 lg:p-8 short:!p-6">
      <EventSummary
        event={event}
        layout="card"
        recommended={recommended}
        saved={saved}
        // No "N people saved this event" on the card itself — it's in the
        // details ("More information").
        actions={
          actionsBelow ? undefined : (
            <FeedCardActions
              event={event}
              saved={saved}
              moreLast={moreLast}
              onMoreInfo={onMoreInfo}
              onSave={onSave}
              onRegister={onRegister}
              onJoinWaitlist={onJoinWaitlist}
              onLeaveWaitlist={onLeaveWaitlist}
            />
          )
        }
      />
    </div>
  );
});

/**
 * The card's two buttons: More information, and Save / Register / Join
 * waitlist / Share event. Inside the card, or under the deck, outside the
 * card (EventsView `actionsBelow`).
 */
export function FeedCardActions({
  event,
  saved,
  moreLast = false,
  onMoreInfo,
  onSave,
  onRegister,
  onJoinWaitlist,
  onLeaveWaitlist,
}: {
  event: Event;
  saved: boolean;
  /** More information after the main button instead of before it. The DOM
      order follows the screen, so Tab and a screen reader meet them in the
      order they are drawn. */
  moreLast?: boolean;
  onMoreInfo: (event: Event) => void;
  onSave: () => void;
  onRegister?: () => void;
  onJoinWaitlist?: () => void;
  onLeaveWaitlist?: () => void;
}) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const [sharing, setSharing] = useState(false);
  // The admin set "needs registration": Register (with a confirm), not Save.
  const register = !!onRegister && event.requires_signup && !saved;
  // A phone-width card is narrower than the design's 20px labels, and two
  // buttons share its row: 16px text, snug sides, a small gap to the icon.
  // On a phone 4px less above and below the label (48px tall, not 56).
  const size =
    "max-sm:gap-1.5 max-sm:px-2 max-sm:text-base max-sm:!min-h-12 max-sm:!py-2 short:!min-h-12 short:!py-2";

  const more = (
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
  );

  const main =
    waitlistState(event) && onJoinWaitlist && onLeaveWaitlist ? (
      <WaitlistAction
        event={event}
        className={size}
        onPointerDown={stop}
        onJoin={onJoinWaitlist}
        onLeave={onLeaveWaitlist}
      />
    ) : register ? (
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
      // Saved: sharing it is the next thing to do (un-saving is in
      // More information and on the saved page).
      <Button
        variant="primary"
        size="lg"
        className={size}
        onClick={() => setSharing(true)}
        onPointerDown={stop}
        trailingIcon={<Send />}
        data-tour="save"
        aria-label={`Share ${event.title}`}
      >
        Share event
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
    );

  return (
    <>
      {!moreLast && more}
      {main}
      {moreLast && more}
      {sharing && (
        <ShareModal
          title="Share this event?"
          eventIds={[event.id]}
          link={{ getUrl: async () => publicEventUrl(event.id) }}
          onClose={() => setSharing(false)}
        />
      )}
    </>
  );
}
