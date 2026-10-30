"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArchiveX,
  Pencil,
  Printer,
  RotateCcw,
} from "lucide-react";
import { ApiError, api, apiMessage, type Event } from "@/lib/api";
import { repeatLabel } from "@/lib/recurrence";
import { eventImage } from "@/lib/eventImage";
import { AdminShell, loginAgainHref, type ConsoleContext } from "@/components/AdminShell";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConsoleCounts } from "@/components/host/ConsoleCounts";
import { EventForm, valuesFromEvent } from "@/components/host/EventForm";
import { useToast } from "@/components/ui/Toast";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { PageHeader } from "@/components/host/PageHeader";
import { PosterSection } from "@/components/host/PosterSection";
import {
  UnpublishModal,
  restoreEvent,
  unpublishedToast,
} from "@/components/host/UnpublishModal";

/**
 * The read-only view of one program. Its own organization (or a superadmin)
 * can edit and un-publish it from here; anyone else can read it in full and
 * share it, which the old list never allowed.
 *
 * An un-published one opens too, for its organization (or a superadmin) to
 * look over before restoring it: a notice and Restore stand in for the tools,
 * and the link and poster are left out, since its public page is gone.
 */
export default function EventDetailsPage() {
  const { id } = useParams<{ id: string }>();
  return <AdminShell>{(ctx) => <EventDetails id={id} ctx={ctx} />}</AdminShell>;
}

function EventDetails({ id, ctx }: { id: string; ctx: ConsoleContext }) {
  const router = useRouter();
  const { show } = useToast();
  const [event, setEvent] = useState<Event | null | undefined>(undefined);
  const [missing, setMissing] = useState("");
  const [unpublishing, setUnpublishing] = useState(false);
  // Un-published: read from /events/archived/{id}, shown with Restore.
  const [archived, setArchived] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    api<Event>(`/events/${id}`)
      .then((ev) => {
        setEvent(ev);
        setArchived(false);
      })
      .catch(async (e) => {
        if (e instanceof ApiError && e.status === 401) router.replace(loginAgainHref());
        else {
          // Un-published, and ours to restore? Then show it, marked as such.
          if (e instanceof ApiError && e.status === 404) {
            try {
              setEvent(await api<Event>(`/events/archived/${id}`));
              setArchived(true);
              return;
            } catch {
              // Not one we can see: fall through to the API's own sentence.
            }
          }
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
  }, [id, router]);

  if (event === null) {
    return (
      <>
        <PageHeader title="Event Details" backHref="/host/events" />
        <p className="mt-6 text-xl text-fg-muted">
          {missing}
        </p>
      </>
    );
  }
  if (!event) return <p className="text-lg text-fg-muted">Loading…</p>;

  const canManage = !archived && (ctx.isSuper || event.host_id === ctx.org.id);

  async function restore() {
    if (!event) return;
    setRestoring(true);
    try {
      await restoreEvent(event.id);
      setEvent(await api<Event>(`/events/${event.id}`));
      setArchived(false);
      show({ title: event.title, description: "was successfully restored" });
    } catch (e) {
      show({
        title: "Couldn't put that back.",
        description: apiMessage(e, "Please refresh and try again."),
        tone: "alert",
      });
    } finally {
      setRestoring(false);
    }
  }
  function print() {
    // Mark just the event, print, then put the page back — the global print
    // rules hide everything outside `.print-target`.
    const el = document.getElementById("event-details");
    el?.classList.add("print-target");
    window.print();
    el?.classList.remove("print-target");
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Event Details"
        subtitle={`Posted by ${event.host_name}`}
        backHref={archived ? "/host/events?scope=unpublished" : "/host/events"}
        actions={
          <>
            {!archived && <CopyLinkButton eventId={event.id} title={event.title} />}
            <Button leadingIcon={<Printer />} onClick={print}>
              Print details
            </Button>
            {archived && (
              <Button
                variant="primary"
                leadingIcon={<RotateCcw />}
                disabled={restoring}
                onClick={() => void restore()}
              >
                {restoring ? "Restoring…" : "Restore"}
              </Button>
            )}
            {canManage && (
              <>
                <Link
                  href={`/host/events/${event.id}/edit`}
                  className={buttonClass("secondary")}
                >
                  Edit Event Details
                  <Pencil aria-hidden="true" className="size-6" />
                </Link>
                <Button
                  variant="danger"
                  trailingIcon={<ArchiveX />}
                  onClick={() => setUnpublishing(true)}
                >
                  Un-publish Event
                </Button>
              </>
            )}
          </>
        }
      />

      {archived && (
        <p
          role="status"
          className="rounded-control border border-line bg-surface-subtle px-4 py-3 text-base text-fg"
        >
          This event is un-published, so members can&apos;t see it. Restore it
          to put every date of it back in the member feed.
        </p>
      )}

      <ConsoleCounts event={event} />

      {/* The event form itself, view only: the answers in the boxes they
          were entered in, nothing editable. `print()` marks this for paper. */}
      <div id="event-details">
        <EventForm
          id="event-view"
          mode="edit"
          readOnly
          hostId={event.host_id}
          values={valuesFromEvent(event)}
          onChange={() => {}}
          submitting={false}
          onSubmit={() => {}}
          error={null}
          submitLabel=""
          submittingLabel=""
          imageFallback={eventImage(event)}
          recurrenceLabel={repeatLabel(event.recurrence)}
        />
      </div>

      {!archived && event.poster_url && <PosterSection event={event} />}

      {unpublishing && (
        <UnpublishModal
          event={event}
          onClose={() => setUnpublishing(false)}
          onDone={() => {
            setUnpublishing(false);
            unpublishedToast(show, event, () =>
              router.push(`/host/events/${event.id}`),
            );
            router.push("/host/events");
          }}
        />
      )}
    </div>
  );
}

/** "12–18", "12 and up", "Up to 18", or nothing for any age. */
function agesLabel(min: number | null | undefined, max: number | null | undefined) {
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `${min} and up`;
  if (max != null) return `Up to ${max}`;
  return null;
}
