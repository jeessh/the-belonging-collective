"use client";

import { useState } from "react";
import { api, apiMessage, type Event } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/Modal";

/**
 * "Are you sure?" before taking a program off the calendar.
 *
 * Un-publish is the one word that is true: the API archives (`deleted_at`),
 * the row and its attendance survive, and `restore` puts it back — which is
 * what the Undo on the toast afterwards calls. `series=true` because the card
 * is the program, so retiring it retires every remaining date, not just the
 * one that happened to be on screen.
 */
export function UnpublishModal({
  event,
  onClose,
  onDone,
}: {
  event: Event;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/events/${event.id}?series=true`, { method: "DELETE" });
      onDone();
    } catch (e) {
      setError(apiMessage(e, "Couldn't un-publish that event."));
      setBusy(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={
        <>
          <p className="text-2xl text-fg">
            Are you sure you want to un-publish this event?
          </p>
          <p className="mt-1 text-2xl font-medium italic text-fg">
            {event.title}
          </p>
        </>
      }
    >
      <p className="mt-3 text-lg text-fg-muted">
        It leaves the member feed straight away. Nothing is deleted — attendance
        already recorded still counts, and you can put it back.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-base text-danger-fg">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={() => void confirm()} disabled={busy}>
          {busy ? "Un-publishing…" : "Yes, un-publish"}
        </Button>
      </div>
    </Modal>
  );
}

/** Puts an un-published program (and its remaining dates) back. */
export const restoreEvent = (id: string) =>
  api(`/events/${id}/restore?series=true`, { method: "POST" });
