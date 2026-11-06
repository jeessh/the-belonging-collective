"use client";

import { meetingUrl } from "@/lib/place";
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
  Link2,
  Share2,
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
import { eventUrl } from "@/components/CopyLinkButton";
import { copyText } from "@/lib/clipboard";
import { Tooltip } from "@/components/ui/Tooltip";
import { PageHeader } from "@/components/host/PageHeader";
import { PostedBy } from "@/components/host/PostedBy";
import { EventAnalyticsPanel } from "@/components/host/EventAnalyticsPanel";
import { EventStatus } from "@/components/host/EventStatus";
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
  // Details | Analytics. ?tab=analytics opens on the numbers, so the tab
  // survives a reload and can be linked to.
  const [tab, setTab] = useState<"details" | "analytics">("details");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "analytics")
      setTab("analytics");
  }, []);
  function chooseTab(next: "details" | "analytics") {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "analytics") url.searchParams.set("tab", "analytics");
    else url.searchParams.delete("tab");
    window.history.replaceState(window.history.state, "", url);
  }
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

  const owns = ctx.isSuper || event.host_id === ctx.org.id;
  const canManage = !archived && owns;
  // The numbers are the organization's own (and a superadmin's); another
  // agency's event shows its details only.
  const showAnalytics = owns && tab === "analytics";

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
  async function share() {
    if (!event) return;
    if (!(await copyText(eventUrl(event.id), show))) return;
    show({
      title: `Link to '${event.title}' copied.`,
      description: "Paste it wherever you're sharing.",
    });
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
        title={event.title}
        titleClassName="event-title"
        subtitle={<PostedBy event={event} />}
        status={<EventStatus state={archived ? "unpublished" : "published"} />}
        backHref={archived ? "/host/events?scope=unpublished" : "/host/events"}
        actions={
          <>
            {/* Share and print are icons (with tooltips saying what they do);
                Edit keeps its word. */}
            {!archived && (
              <Tooltip text="Copy a link to this event to share">
                {(tip) => (
                  <Button
                    aria-label={`Share ${event.title}`}
                    aria-describedby={tip}
                    onClick={() => void share()}
                    leadingIcon={<Share2 />}
                  />
                )}
              </Tooltip>
            )}
            <Tooltip text="Print these details">
              {(tip) => (
                <Button
                  aria-label={`Print the details of ${event.title}`}
                  aria-describedby={tip}
                  onClick={print}
                  leadingIcon={<Printer />}
                />
              )}
            </Tooltip>
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
                  <Pencil aria-hidden="true" className="size-6" />
                  Edit
                </Link>
                <Button
                  variant="danger"
                  trailingIcon={<ArchiveX />}
                  onClick={() => setUnpublishing(true)}
                >
                  Un-publish
                </Button>
              </>
            )}
          </>
        }
      />

      {owns && (
        <div
          role="tablist"
          aria-label="Event"
          className="-mt-2 flex max-w-[1200px] gap-6 border-b border-line"
        >
          {(
            [
              ["details", "Details"],
              ["analytics", "Analytics"],
            ] as const
          ).map(([key, label]) => {
            const on = (key === "analytics") === showAnalytics;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={on}
                aria-controls={`panel-${key}`}
                tabIndex={on ? 0 : -1}
                onClick={() => chooseTab(key)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  const next = key === "details" ? "analytics" : "details";
                  chooseTab(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }}
                className={`-mb-px border-b-2 pb-3 pt-1 text-base ${
                  on
                    ? "border-fg font-medium text-fg"
                    : "border-transparent text-fg-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {showAnalytics ? (
        <div role="tabpanel" id="panel-analytics" aria-labelledby="tab-analytics">
          <EventAnalyticsPanel eventId={event.id} />
        </div>
      ) : (
      <div
        role={owns ? "tabpanel" : undefined}
        id="panel-details"
        aria-labelledby={owns ? "tab-details" : undefined}
        className="flex flex-col gap-8"
      >
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
          <h2 className="group-heading text-xl font-medium text-fg">Event details</h2>
          <ReadField label="Event image">
            {/* The form's frame: 300px tall, full width, cropped to fill. */}
            <div className="h-[300px] w-full overflow-hidden rounded-control bg-surface-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={eventImage(event)} alt="" className="h-full w-full object-cover" />
            </div>
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
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-8">
            <ReadField label="Where">{event.is_virtual ? "Virtual" : "In-Person"}</ReadField>
            <ReadField label={event.is_virtual ? "Meeting link" : "Address"}>
              {meetingUrl(event) ? (
                <Line icon={<Link2 />}>
                  <a
                    href={meetingUrl(event)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all underline underline-offset-2"
                  >
                    {event.location}
                  </a>
                </Line>
              ) : (
                <Line icon={<MapPin />}>
                  {event.location || (event.is_virtual ? "None" : "Location to be announced")}
                </Line>
              )}
            </ReadField>
          </div>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadField label="Cost">{event.is_free ? "Free" : "Paid"}</ReadField>
              <ReadField label="How people join">
                {event.requires_signup ? "Registration" : "Drop-in"}
              </ReadField>
            </div>
            {!event.is_free && (
              <ReadField label="How is it paid?">{event.price_label || "Paid"}</ReadField>
            )}
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
            <ReadField label="Other links">
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

        </div>
      </article>

      {!archived && event.poster_url && <PosterSection event={event} />}
      </div>
      )}

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
 * A form field, read back: the form's label over its answer. Unlike the
 * form's own labels (light, since the answers sit in boxes), these are
 * medium weight — with nothing boxing the answer, weight is what tells the
 * label from what it describes.
 */
function ReadField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field flex min-w-0 flex-col gap-2">
      <p className="text-base font-medium text-fg">{label}</p>
      <div className="text-base font-normal text-fg">{children}</div>
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
