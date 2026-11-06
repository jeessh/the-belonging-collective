"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError, api, apiMessage, type Event } from "@/lib/api";
import { AdminShell, loginAgainHref, type ConsoleContext } from "@/components/AdminShell";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/host/PageHeader";
import { PostedBy } from "@/components/host/PostedBy";
import { EventStatus } from "@/components/host/EventStatus";
import { eventImage } from "@/lib/eventImage";
import { ArchiveX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UnpublishModal, unpublishedToast } from "@/components/host/UnpublishModal";
import {
  EventForm,
  payloadFrom,
  useLeaveGuard,
  valuesFromEvent,
  type EventFormValues,
} from "@/components/host/EventForm";

/**
 * Editing is the create form, prefilled. One form for both is what keeps
 * the listing format standard: two forms with different ideas of what a
 * program needs is how it stops being.
 */
export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  return <AdminShell>{(ctx) => <EditEvent id={id} ctx={ctx} />}</AdminShell>;
}

const FORM_ID = "edit-event";

function EditEvent({ id, ctx }: { id: string; ctx: ConsoleContext }) {
  const router = useRouter();
  const { show } = useToast();
  const [event, setEvent] = useState<Event | null | undefined>(undefined);
  const [missing, setMissing] = useState("");
  const [values, setValues] = useState<EventFormValues | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unpublishing, setUnpublishing] = useState(false);
  const { onBack, dialog } = useLeaveGuard(
    !!event &&
      !!values &&
      JSON.stringify(values) !== JSON.stringify(valuesFromEvent(event)),
  );

  useEffect(() => {
    api<Event>(`/events/${id}`)
      .then((ev) => {
        // Admins manage their own programming; superadmins manage anyone's.
        // The API enforces it — this keeps a read-only viewer off a form
        // whose save would be refused.
        if (!ctx.isSuper && ev.host_id !== ctx.org.id) {
          router.replace(`/host/events/${id}`);
          return;
        }
        setEvent(ev);
        setValues(valuesFromEvent(ev));
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace(loginAgainHref());
        else {
          // The API says which: "That event isn't published any more." for
          // an archived one, "We couldn't find that event." for a bad link
          // (a non-UUID id is a 422 with no sentence to show).
          setMissing(
            e instanceof ApiError && e.status === 404
              ? apiMessage(e, "We couldn't find that event.")
              : e instanceof ApiError && e.status === 422
                ? "We couldn't find that event."
                : "Couldn't load that event. Please refresh and try again.",
          );
          setEvent(null);
        }
      });
  }, [id, ctx, router]);

  async function save() {
    if (!event || !values) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await api<Event>(`/events/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify(payloadFrom(values)),
      });
      show({ title: saved.title, description: "was successfully edited" });
      router.push(`/host/events/${event.id}`);
    } catch (e) {
      setError(apiMessage(e, "Couldn't save this event. Please try again."));
      setBusy(false);
    }
  }

  if (event === null) {
    return (
      <>
        <PageHeader title="Edit Event Details" backHref="/host/events" />
        <p className="mt-6 text-xl text-fg-muted">
          {missing}
        </p>
      </>
    );
  }
  if (!event || !values) {
    return <p className="text-lg text-fg-muted">Loading…</p>;
  }

  return (
    // Wider margins than other console pages, centred: the form (1200px at
    // most) sits in the middle of the page.
    <div className="mx-auto flex w-full max-w-[1296px] flex-col sm:px-4 sm:py-2 lg:px-12 lg:py-4">
      <EventForm
        id={FORM_ID}
        mode="edit"
        hostId={event.host_id}
        inSeries={(event.series_total ?? 1) > 1}
        values={values}
        onChange={(update) => setValues((v) => (v ? update(v) : v))}
        submitting={busy}
        onSubmit={() => void save()}
        error={error}
        submitLabel="Save Edits"
        submittingLabel="Saving…"
        imageFallback={eventImage(event)}
        header={{
          backHref: `/host/events/${event.id}`,
          backLabel: "Back to event details",
          onBack,
          subtitle: <PostedBy event={event} />,
          status: <EventStatus state="published" />,
          actions: (
            <Button
              variant="danger"
              trailingIcon={<ArchiveX />}
              disabled={busy}
              onClick={() => setUnpublishing(true)}
            >
              Un-publish
            </Button>
          ),
        }}
      />
      {dialog}
      {unpublishing && (
        <UnpublishModal
          event={event}
          onClose={() => setUnpublishing(false)}
          onDone={() => {
            setUnpublishing(false);
            unpublishedToast(show, event, () => router.push(`/host/events/${event.id}`));
            router.push("/host/events");
          }}
        />
      )}
    </div>
  );
}
