"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { ApiError, api, apiMessage, type Event } from "@/lib/api";
import { AdminShell, type ConsoleContext } from "@/components/AdminShell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/host/PageHeader";
import {
  EMPTY_FORM,
  EventForm,
  payloadFrom,
  type EventFormValues,
} from "@/components/host/EventForm";

export default function NewEventPage() {
  return <AdminShell>{(ctx) => <NewEventForm ctx={ctx} />}</AdminShell>;
}

const FORM_ID = "new-event";

function NewEventForm({ ctx }: { ctx: ConsoleContext }) {
  const router = useRouter();
  const { show } = useToast();
  const [values, setValues] = useState<EventFormValues>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const created = await api<Event>("/events", {
        method: "POST",
        body: JSON.stringify(payloadFrom(values)),
      });
      // Undo matters more than the confirmation does: publishing to a shared
      // calendar is where "wait, no" arrives a second late.
      show({
        title: "Event Successfully Published!",
        description: created.title,
        action: {
          label: "Undo",
          onClick: () => {
            void api(`/events/${created.id}?series=true`, { method: "DELETE" })
              .then(() => router.push("/host/events"))
              .catch(() =>
                show({
                  title: "Couldn't undo that.",
                  description: "Open the event and un-publish it instead.",
                  tone: "alert",
                }),
              );
          },
        },
      });
      router.push(`/host/events/${created.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/host");
        return;
      }
      setError(
        apiMessage(e, "Couldn't publish that event. Check the fields and retry."),
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-9">
      <PageHeader
        title="Create a New Event"
        backHref="/host/events"
        actions={
          <>
            <span className="text-base text-fg-muted">
              Posting under {ctx.org.name}
            </span>
            <Button
              type="submit"
              form={FORM_ID}
              variant="primary"
              disabled={busy}
              trailingIcon={<Upload />}
            >
              {busy ? "Publishing…" : "Publish Event"}
            </Button>
          </>
        }
      />
      <EventForm
        id={FORM_ID}
        mode="create"
        hostId={ctx.session.id ?? ""}
        values={values}
        onChange={setValues}
        submitting={busy}
        onSubmit={() => void publish()}
        error={error}
      />
    </div>
  );
}
