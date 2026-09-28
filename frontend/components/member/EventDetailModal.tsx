"use client";

import { useCallback, useRef, useState } from "react";
import { Bookmark, ExternalLink, MapPin, SquareX } from "lucide-react";
import type { Event } from "@/lib/api";
import { hostnameOf, mapsUrl } from "@/lib/share";
import { Modal } from "@/components/Modal";
import { Button, buttonClass } from "@/components/ui/Button";
import { GoingCount } from "@/components/ui/GoingCount";
import { EventDetails } from "@/components/member/EventDetails";
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
  onOpenRegistration,
  onRequestAccess,
  onSignIn,
}: {
  event: Event;
  saved: boolean;
  onClose: () => void;
  onSave: (event: Event) => void;
  onUnsave: (event: Event) => void;
  /** Only used when registration lives on the organizer's own site. */
  onOpenRegistration: (event: Event) => void;
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

  const external =
    event.requires_signup &&
    event.registration_mode === "external" &&
    !!event.registration_url;
  const maps = mapsUrl(event.location);
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
        closeOutside
        onClose={close}
      >
        <EventDetails
          event={event}
          titleAs="h2"
          titleId={TITLE_ID}
          going={<GoingCount count={event.saved_count} onSignIn={onSignIn} />}
          // Room for the dialog's own close button while it sits inside.
          tools={
            <div className="pr-12 xl:pr-0">
              <EventTools event={event} />
            </div>
          }
          hint={external ? hostnameOf(event.registration_url) : undefined}
          actions={
            <>
              {maps && (
                <a
                  href={maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("secondary", "lg")}
                >
                  Google Maps
                  <MapPin aria-hidden="true" className="size-6 shrink-0" />
                </a>
              )}
              {!canSave ? (
                <AccessAction
                  state={access}
                  busy={requesting}
                  onRequest={() => {
                    setRequesting(true);
                    void onRequestAccess(event).finally(() => setRequesting(false));
                  }}
                />
              ) : saved ? (
                <Button
                  variant="danger"
                  size="lg"
                  onClick={() => onUnsave(event)}
                  trailingIcon={<SquareX />}
                >
                  Un-Save Event
                </Button>
              ) : (
                <Button
                  variant={external ? "secondary" : "primary"}
                  size="lg"
                  onClick={() => onSave(event)}
                  trailingIcon={<Bookmark />}
                >
                  Save event
                </Button>
              )}
              {external && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => onOpenRegistration(event)}
                  trailingIcon={<ExternalLink />}
                >
                  Register for Event
                </Button>
              )}
            </>
          }
        />
      </Modal>
    </div>
  );
}
