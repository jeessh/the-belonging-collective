"use client";

import { ExternalLink, ClipboardPen } from "lucide-react";
import type { Event } from "@/lib/api";
import { hostnameOf } from "@/lib/share";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/Button";

/**
 * "Register for …?" — asked before an event that needs registering is
 * registered for. Confirming saves it to the member's list and, when the
 * organizer registers people on their own site, opens that page in a new
 * tab. Cancel leaves everything as it was.
 */
export function RegisterConfirm({
  event,
  onConfirm,
  onClose,
}: {
  event: Event;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const external =
    event.registration_mode === "external" && !!event.registration_url;
  const site = external ? hostnameOf(event.registration_url) : null;

  return (
    // Above the event dialog (z-[60]) when it is opened from there.
    <div className="relative z-[70]">
      <Modal title={`Register for ${event.title}?`} onClose={onClose}>
        <p className="mt-2 text-xl leading-[1.4] text-fg-muted">
          {external ? (
            <>
              This event asks you to register on{" "}
              <a
                href={event.registration_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-medium text-fg underline underline-offset-4"
              >
                {site}
              </a>
              . Are you sure you want to continue?
            </>
          ) : (
            "We'll register you and add it to your saved events."
          )}
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row [&>*]:flex-1">
          <Button size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onConfirm}
            trailingIcon={external ? <ExternalLink /> : <ClipboardPen />}
          >
            {/* Short, so the pair fits any width (the site is named above). */}
            {external ? "Continue" : "Register"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
