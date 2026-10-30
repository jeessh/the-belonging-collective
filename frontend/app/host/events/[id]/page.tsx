"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArchiveX,
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  Printer,
  QrCode,
  RotateCcw,
} from "lucide-react";
import { ApiError, api, apiMessage, type Event } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";
import { longDate, timeRange } from "@/lib/time";
import { repeatLabel } from "@/lib/recurrence";
import { isDerivedTag, tagLabel } from "@/lib/accessibility";
import { eventImage } from "@/lib/eventImage";
import { AdminShell, loginAgainHref, type ConsoleContext } from "@/components/AdminShell";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConsoleCounts } from "@/components/host/ConsoleCounts";
import { Tag, eventTags } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { PageHeader } from "@/components/host/PageHeader";
import { PosterSection } from "@/components/host/PosterSection";
import { PosterSheet, printSheet } from "@/components/host/PrintSheets";
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
  const { label: topicLabel } = useCategories();

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
  const facts: [string, ReactNode][] = [
    ["Organization", event.host_name],
    ["Cost", event.price_label || (event.is_free ? "Free" : "Paid")],
    [
      "Topics",
      (event.categories?.length ? event.categories : [event.category])
        .map(topicLabel)
        .filter(Boolean)
        .join(", "),
    ],
    ["Repeats", repeatLabel(event.recurrence)],
    ["Spots available", event.capacity != null ? String(event.capacity) : null],
    ["Ages", agesLabel(event.min_age, event.max_age)],
    ["Who it's for", event.is_youth ? "Youth" : null],
    [
      "Who can see it",
      event.access_group
        ? `Special access — ${event.access_group.name}`
        : "Everyone",
    ],
    // Free and drop-in are already on the tag pills.
    [
      "Offers",
      event.accessibility_tags.filter((t) => !isDerivedTag(t)).map(tagLabel).join(", ") ||
        null,
    ],
    [
      // The form calls it a posting link for a drop-in and a sign-up link
      // when registration is needed; either way it's shown.
      event.requires_signup ? "Sign-up link" : "Posting link",
      event.registration_url ? (
        <a
          href={event.registration_url}
          target="_blank"
          rel="noreferrer"
          className="break-all underline underline-offset-4"
        >
          {event.registration_url}
        </a>
      ) : null,
    ],
  ];

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
        backHref={archived ? "/host/events?scope=unpublished" : "/host/events"}
        actions={
          <>
            {!archived && <CopyLinkButton eventId={event.id} title={event.title} />}
            <Button leadingIcon={<Printer />} onClick={print}>
              Print details
            </Button>
            {!archived && (
              <Button
                leadingIcon={<QrCode />}
                onClick={() => printSheet(document.getElementById("program-poster"))}
              >
                Print poster
              </Button>
            )}
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

      <article
        id="event-details"
        // The event form's columns (EventForm), so a program keeps its shape
        // from editing to reading: the smaller left column for the picture
        // and when / where, the wider right one for everything else.
        className="grid max-w-[1200px] items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        <div className="flex flex-col gap-6">
          {/* Square, as the form previews it. */}
          <div className="aspect-square w-full overflow-hidden rounded-control bg-surface-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={eventImage(event)}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <Fact label="Name of Event">
            <h2 className="text-xl text-fg">{event.title}</h2>
          </Fact>
          <Fact label="Date">
            <Line icon={<CalendarDays />}>
              {longDate(event.starts_at) || "Date to be announced"}
            </Line>
          </Fact>
          <Fact label="Time">
            <Line icon={<Clock />}>
              {timeRange(event.starts_at, event.ends_at) || "—"}
            </Line>
          </Fact>
          <Fact label="Location">
            <Line icon={<MapPin />}>
              {event.location ||
                (event.is_virtual ? "Online" : "Location to be announced")}
            </Line>
          </Fact>
          <ConsoleCounts event={event} className="text-xl" />
        </div>

        <div className="flex flex-col gap-6">
          <Fact label="Brief Description">
            <p className="whitespace-pre-line text-xl text-fg">
              {event.description}
            </p>
          </Fact>
          {event.notes && (
            <Fact label="Extra details">
              <p className="whitespace-pre-line text-xl text-fg">{event.notes}</p>
            </Fact>
          )}
          {!!event.links?.length && (
            <Fact label="Important Links">
              <ol className="flex list-decimal flex-col gap-4 pl-8 text-xl text-fg">
                {event.links.map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ol>
            </Fact>
          )}
          <Fact label="Event Tags">
            <div className="flex flex-wrap gap-4">
              {eventTags(event).map((kind) => (
                <Tag key={kind} kind={kind} />
              ))}
              {event.access_group && (
                <Tag kind="access" detail={event.access_group.name} />
              )}
            </div>
          </Fact>
          <dl className="grid gap-x-6 gap-y-2 border-t border-line pt-6 text-lg sm:grid-cols-[max-content_minmax(0,1fr)]">
            {facts
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="font-medium text-fg">{label}</dt>
                  <dd className="text-fg">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      </article>

      {!archived && event.poster_url && <PosterSection event={event} />}
      {!archived && <PosterSheet id="program-poster" event={event} />}

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

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-2xl font-medium text-fg">{label}</p>
      {children}
    </div>
  );
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xl text-fg">
      <span aria-hidden="true" className="info-icon shrink-0 text-fg-icon [&>svg]:size-6">
        {icon}
      </span>
      {children}
    </p>
  );
}
