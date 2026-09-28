"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { ApiError, api, apiMessage, type Event } from "@/lib/api";
import { AdminShell, type ConsoleContext } from "@/components/AdminShell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/host/PageHeader";
import {
  EventForm,
  payloadFrom,
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
  const [values, setValues] = useState<EventFormValues | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (e instanceof ApiError && e.status === 401) router.replace("/host");
        else setEvent(null);
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
      show({ title: `'${saved.title}' was successfully edited.` });
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
          That event isn&apos;t published any more.
        </p>
      </>
    );
  }
  if (!event || !values) {
    return <p className="text-lg text-fg-muted">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-9">
      <PageHeader
        title="Edit Event Details"
        backHref={`/host/events/${event.id}`}
        backLabel="Back to event details"
        actions={
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            disabled={busy}
            trailingIcon={<Upload />}
          >
            {busy ? "Saving…" : "Save Edits"}
          </Button>
        }
      />
      <EventForm
        id={FORM_ID}
        mode="edit"
        hostId={event.host_id}
        values={values}
        onChange={setValues}
        submitting={busy}
        onSubmit={() => void save()}
        error={error}
      />
    </div>
  );
}
