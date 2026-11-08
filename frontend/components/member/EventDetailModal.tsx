"use client";

import { useCallback, useRef, useState } from "react";
import { Bookmark, ClipboardPen, Trash2 } from "lucide-react";
import type { Event } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";
import { GoingCount } from "@/components/ui/GoingCount";
import { EventDetails } from "@/components/member/EventDetails";
import { WaitlistAction, waitlistState } from "@/components/member/WaitlistAction";
import { EventTools } from "@/components/member/EventTools";
import { AccessAction, accessStateOf } from "@/components/member/AccessAction";

const TITLE_ID = "event-detail-title";

/**
 * "More information", over the feed. The listing stays put behind it, so
 * there is nothing to find again afterwards. Saving here flips the button to
 * Un-Save rather than closing — the member may want the map or the links next.
 */
export function EventDetailModal({
  event,
  saved,
  onClose,
  onSave,
  onUnsave,
  onRegister,
  onJoinWaitlist,
  onLeaveWaitlist,
  onRequestAccess,
  onSignIn,
}: {
  /** A full program: join, or leave, its waitlist. */
  onJoinWaitlist: (event: Event) => void;
  onLeaveWaitlist: (event: Event) => void;
  event: Event;
  saved: boolean;
  onClose: () => void;
  onSave: (event: Event) => void;
  onUnsave: (event: Event) => void;
  /** An event that needs registering: ask to confirm, then register. */
  onRegister: (event: Event) => void;
  /** A restricted program the member is not yet approved for. */
  onRequestAccess: (event: Event) => Promise<void>;
  /** For "See who else is going" when nobody is signed in. */
  onSignIn: () => void;
}) {
  // The Modal re-runs its focus setup whenever `onClose` changes identity, and
  // the feed passes a fresh arrow each render — so it gets one stable function.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => onCloseRef.current(), []);

  // A virtual event's "location" is a meeting app, not a place to map.
  // Save is for approved members only; everyone else gets the access control.
  const access = accessStateOf(event);
  const canSave = access === null || access === "approved";
  const [requesting, setRequesting] = useState(false);

  return (
    // Lifts the fixed Modal above the feed chrome, which sits at z-50.
    <div className="relative z-[60]">
      <Modal
        title={null}
        labelId={TITLE_ID}
        size="lg"
        snug
        onClose={close}
      >
        <EventDetails
          event={event}
          titleAs="h2"
          titleId={TITLE_ID}
          going={<GoingCount capacity={event.capacity} count={event.saved_count} onSignIn={onSignIn} iconClassName="size-7" />}
          insetForClose
          tools={<EventTools event={event} lead={saved && canSave} />}
          toolsFill={saved && canSave}
          actions={
            <>
              {!canSave ? (
                <AccessAction
                  state={access}
                  busy={requesting}
                  onRequest={() => {
                    setRequesting(true);
                    void onRequestAccess(event).finally(() => setRequesting(false));
                  }}
                />
              ) : waitlistState(event) ? (
                <WaitlistAction
                  event={event}
                  onJoin={() => onJoinWaitlist(event)}
                  onLeave={() => onLeaveWaitlist(event)}
                />
              ) : saved ? (
                // Tertiary once saved: Share and Print lead.
                <Button
                  variant="ghost"
                  size="lg"
                  // Red words, no fill: careful, but not the lead. Pulled
                  // out by its padding so the words line up with DETAILS
                  // and the text above.
                  className="-ml-6 !text-danger-fg [&_svg]:!text-danger-fg"
                  onClick={() => onUnsave(event)}
                  trailingIcon={<Trash2 />}
                >
                  Un-Save Event
                </Button>
              ) : event.requires_signup ? (
                // Needs registering: Register, confirmed first (which saves
                // it and opens the organizer's page when there is one).
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => onRegister(event)}
                  trailingIcon={<ClipboardPen />}
                >
                  Register
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => onSave(event)}
                  trailingIcon={<Bookmark />}
                >
                  Save Event
                </Button>
              )}
            </>
          }
        />
      </Modal>
    </div>
  );
}
