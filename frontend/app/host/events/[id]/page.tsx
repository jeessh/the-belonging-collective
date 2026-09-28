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
} from "lucide-react";
import { ApiError, api, type Event } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";
import { longDate, timeRange } from "@/lib/time";
import { repeatLabel } from "@/lib/recurrence";
import { isDerivedTag, tagLabel } from "@/lib/accessibility";
import { AdminShell, type ConsoleContext } from "@/components/AdminShell";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConsoleCounts } from "@/components/host/ConsoleCounts";
import { Tag, eventTags } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { PageHeader } from "@/components/host/PageHeader";
import { PosterSection } from "@/components/host/PosterSection";
import { PosterSheet, printSheet } from "@/components/host/PrintSheets";
import { UnpublishModal, restoreEvent } from "@/components/host/UnpublishModal";

/**
 * The read-only view of one program. Its own organization (or a superadmin)
 * can edit and un-publish it from here; anyone else can read it in full and
 * share it, which the old list never allowed.
 */
export default function EventDetailsPage() {
  const { id } = useParams<{ id: string }>();
  return <AdminShell>{(ctx) => <EventDetails id={id} ctx={ctx} />}</AdminShell>;
}

function EventDetails({ id, ctx }: { id: string; ctx: ConsoleContext }) {
  const router = useRouter();
  const { show } = useToast();
  const [event, setEvent] = useState<Event | null | undefined>(undefined);
  const [unpublishing, setUnpublishing] = useState(false);
  const { label: topicLabel } = useCategories();

  useEffect(() => {
    api<Event>(`/events/${id}`)
      .then(setEvent)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/host");
        else setEvent(null);
      });
  }, [id, router]);

  if (event === null) {
    return (
      <>
        <PageHeader title="Event Details" backHref="/host/events" />
        <p className="mt-6 text-xl text-fg-muted">
          That event isn&apos;t published any more.
        </p>
      </>
    );
  }
  if (!event) return <p className="text-lg text-fg-muted">Loading…</p>;

  const canManage = ctx.isSuper || event.host_id === ctx.org.id;
  const facts: [string, ReactNode][] = [
    ["Organization", event.host_name],
    ["Cost", event.price_label || (event.is_free ? "Free" : "Paid")],
    [
      "Activity Type",
      (event.categories?.length ? event.categories : [event.category])
        .map(topicLabel)
        .filter(Boolean)
        .join(", "),
    ],
    ["Repeats", repeatLabel(event.recurrence)],
    ["Spaces", event.capacity != null ? String(event.capacity) : null],
    [
      "Ages",
      event.min_age != null || event.max_age != null
        ? `${event.min_age ?? "Any"} – ${event.max_age ?? "any"}`
        : null,
    ],
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
      "Sign-up link",
      event.requires_signup && event.registration_url ? (
        <a
          href={event.registration_url}
          target="_blank"
          rel="noreferrer"
          className="break-all text-[#307CFF] underline underline-offset-4"
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
        backHref="/host/events"
        actions={
          <>
            <CopyLinkButton eventId={event.id} title={event.title} />
            <Button leadingIcon={<Printer />} onClick={print}>
              Print
            </Button>
            <Button
              leadingIcon={<Printer />}
              onClick={() => printSheet(document.getElementById("program-poster"))}
            >
              Print poster
            </Button>
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

      <article
        id="event-details"
        className="grid gap-x-9 gap-y-8 lg:grid-cols-[598px_minmax(0,1fr)]"
      >
        <div className="flex flex-col gap-6">
          <div className="aspect-[598/278] w-full overflow-hidden rounded-control bg-surface-subtle">
            {event.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.cover_image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
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
              <ol className="flex list-decimal flex-col gap-4 pl-8 text-xl text-[#307CFF]">
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

      {event.poster_url && <PosterSection event={event} />}
      <PosterSheet id="program-poster" event={event} />

      {unpublishing && (
        <UnpublishModal
          event={event}
          onClose={() => setUnpublishing(false)}
          onDone={() => {
            setUnpublishing(false);
            show({
              title: `'${event.title}' was un-published.`,
              tone: "alert",
              action: {
                label: "Undo",
                onClick: () => {
                  void restoreEvent(event.id)
                    .then(() => router.push(`/host/events/${event.id}`))
                    .catch(() =>
                      show({
                        title: "Couldn't put that back.",
                        description: "Please refresh and try again.",
                        tone: "alert",
                      }),
                    );
                },
              },
            });
            router.push("/host/events");
          }}
        />
      )}
    </div>
  );
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
      <span aria-hidden="true" className="shrink-0 text-fg-icon [&>svg]:size-6">
        {icon}
      </span>
      {children}
    </p>
  );
}
