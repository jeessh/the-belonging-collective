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
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { ApiError, api, apiMessage, type Event } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";
import { longDate, timeRange } from "@/lib/time";
import { repeatLabel } from "@/lib/recurrence";
import { isDerivedTag, tagIcon, tagLabel } from "@/lib/accessibility";
import { categoryStyle } from "@/lib/categories";
import { eventImage } from "@/lib/eventImage";
import { AdminShell, loginAgainHref, type ConsoleContext } from "@/components/AdminShell";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConsoleCounts } from "@/components/host/ConsoleCounts";
import { Glyph } from "@/components/ui/Glyph";
import { Group } from "@/components/host/EventForm";
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

      <article
        id="event-details"
        // The event form's layout, group for group and in its words, so an
        // event reads back exactly as it was entered — every field, with
        // what an empty one means ("None", "No limit", "Any age").
        className="grid max-w-[1200px] items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <ReadField label="Event image">
            {/* The form's frame: 300px tall, full width, cropped to fill. */}
            <div className="h-[300px] w-full overflow-hidden rounded-control bg-surface-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={eventImage(event)} alt="" className="h-full w-full object-cover" />
            </div>
          </ReadField>
          <ReadField label="Name of Event">
            <h2 className="text-base font-medium text-fg">{event.title}</h2>
          </ReadField>
          <ReadField label="Date">
            <Line icon={<CalendarDays />}>
              {longDate(event.starts_at) || "Date to be announced"}
            </Line>
          </ReadField>
          <ReadField label="Time">
            <Line icon={<Clock />}>
              {timeRange(event.starts_at, event.ends_at) || "—"}
            </Line>
          </ReadField>
          <ReadField label="Where">{event.is_virtual ? "Virtual" : "In-Person"}</ReadField>
          <ReadField label={event.is_virtual ? "Location (online)" : "Location"}>
            <Line icon={<MapPin />}>
              {event.location || (event.is_virtual ? "Online" : "Location to be announced")}
            </Line>
          </ReadField>
          <ReadField label="Repeats">{repeatLabel(event.recurrence) || "Doesn't repeat"}</ReadField>
          <ConsoleCounts event={event} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Group title="Description">
            <ReadField label="Brief Description">
              <p className="whitespace-pre-line">{event.description}</p>
            </ReadField>
          </Group>

          <Group title="Cost & sign-up">
            <ReadField label="Cost">{event.is_free ? "Free" : "Paid"}</ReadField>
            {!event.is_free && (
              <ReadField label="How is it paid?">{event.price_label || "Paid"}</ReadField>
            )}
            <ReadField label="How people join">
              {event.requires_signup ? "Registration" : "Drop-in"}
            </ReadField>
            <ReadField label={event.requires_signup ? "Sign-up link" : "Posting link"}>
              {event.registration_url ? (
                <a
                  href={event.registration_url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all underline underline-offset-4"
                >
                  {event.registration_url}
                </a>
              ) : (
                "None"
              )}
            </ReadField>
          </Group>

          <Group title="Who it's for">
            <div className="grid gap-4 sm:grid-cols-3">
              <ReadField label="Spots available">
                {event.capacity != null ? String(event.capacity) : "No limit"}
              </ReadField>
              <ReadField label="Youngest age">
                {event.min_age != null ? String(event.min_age) : "Any"}
              </ReadField>
              <ReadField label="Oldest age">
                {event.max_age != null ? String(event.max_age) : "Any"}
              </ReadField>
            </div>
            <ReadField label="Who is it for?">{event.is_youth ? "Youth" : "Everyone"}</ReadField>
            <ReadField label="What does it offer?">
              <IconList
                items={event.accessibility_tags
                  .filter((t) => !isDerivedTag(t))
                  .map((t) => ({ key: t, icon: tagIcon(t), label: tagLabel(t) }))}
              />
            </ReadField>
            <ReadField label="Who can see this">
              {event.access_group ? `Special access — ${event.access_group.name}` : "Everyone"}
            </ReadField>
          </Group>

          <Group title="Topics">
            <IconList
              items={(event.categories?.length ? event.categories : [event.category])
                .filter((slug): slug is string => !!slug)
                .map((slug) => ({
                  key: slug,
                  icon: categoryStyle(slug).icon,
                  label: topicLabel(slug),
                }))}
            />
          </Group>

          <Group title="Details & links">
            <ReadField label="Important Links">
              {event.links?.length ? (
                <ol className="flex list-decimal flex-col gap-1 pl-5">
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
              ) : (
                "None"
              )}
            </ReadField>
            <ReadField label="Extra details">
              {event.notes ? <p className="whitespace-pre-line">{event.notes}</p> : "None"}
            </ReadField>
            <ReadField label="Printable poster">
              {event.poster_url ? (
                <a
                  href={event.poster_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  Open the poster
                </a>
              ) : (
                "None"
              )}
            </ReadField>
          </Group>
        </div>
      </article>

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

/**
 * A form field, read back: the form's label over its answer. The label is
 * the form's light one (regular, grey — `.field-label`); the answer is
 * medium weight, so what was entered leads and the label stays quiet.
 */
function ReadField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field flex min-w-0 flex-col gap-2">
      <p className="field-label text-base text-fg">{label}</p>
      <div className="text-base font-medium text-fg">{children}</div>
    </div>
  );
}

/** Chosen chips, read back: icon + label each, or "None". */
function IconList({
  items,
}: {
  items: { key: string; icon: LucideIcon; label: string }[];
}) {
  if (!items.length) return <>None</>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map(({ key, icon, label }) => (
        <li
          key={key}
          className="inline-flex items-center gap-2 rounded-control border border-line px-3 py-1 text-base text-fg"
        >
          <Glyph icon={icon} className="text-fg-icon" />
          {label}
        </li>
      ))}
    </ul>
  );
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-base text-fg">
      <span aria-hidden="true" className="info-icon shrink-0 text-fg-icon [&>svg]:size-6">
        {icon}
      </span>
      {children}
    </p>
  );
}
