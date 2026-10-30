"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { ApiError, api, apiMessage, type Event } from "@/lib/api";
import { AdminShell, loginAgainHref, type ConsoleContext } from "@/components/AdminShell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  EMPTY_FORM,
  EventForm,
  payloadFrom,
  useLeaveGuard,
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
  const { onBack, dialog } = useLeaveGuard(
    JSON.stringify(values) !== JSON.stringify(EMPTY_FORM),
  );

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
        title: created.title,
        description: "was successfully published",
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
        router.replace(loginAgainHref());
        return;
      }
      setError(
        apiMessage(e, "Couldn't publish that event. Check the fields and try again."),
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <EventForm
        id={FORM_ID}
        mode="create"
        hostId={ctx.org.id}
        values={values}
        onChange={setValues}
        submitting={busy}
        onSubmit={() => void publish()}
        error={error}
        submitLabel="Publish Event"
        submittingLabel="Publishing…"
        header={{
          backHref: "/host/events",
          onBack,
          subtitle: `Posting under ${ctx.org.name}`,
          // Publish here and at the foot of the form, as Edit has Save.
          actions: (
            <Button
              type="submit"
              form={FORM_ID}
              variant="primary"
              disabled={busy}
              trailingIcon={<Upload />}
            >
              {busy ? "Publishing…" : "Publish Event"}
            </Button>
          ),
        }}
      />
      {dialog}
    </div>
  );
}
