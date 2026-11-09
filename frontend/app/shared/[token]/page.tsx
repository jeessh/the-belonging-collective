import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { buttonClass } from "@/components/ui/Button";
import { EventTags } from "@/components/ui/EventSummary";
import { GoingCount } from "@/components/ui/GoingCount";
import { PostedBy } from "@/components/host/PostedBy";
import { eventImage } from "@/lib/eventImage";
import { placeLabel } from "@/lib/place";
import { whenLine } from "@/lib/time";
import { GoogleCalendarIcon } from "@/components/ui/GoogleCalendarIcon";
import { googleCalendarUrl } from "@/lib/calendar";
import { fetchSharedList } from "@/lib/serverApi";

// A member's list, for whoever they gave the link to. Server-rendered and
// read-only; there is nothing to sign in to here. Kept out of search — the
// link is for the people it was sent to, not the open web.

type Params = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Shared programs",
  robots: { index: false, follow: false },
};

export default async function SharedListPage({ params }: Params) {
  const { token } = await params;
  const list = await fetchSharedList(token);
  if (!list) notFound();
  const count = list.events.length;

  return (
    <div className="min-h-dvh bg-surface text-fg">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-[1012px] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium sm:text-4xl">
            {list.first_name}&apos;s saved programs
          </h1>
          <p className="text-xl text-fg-muted">
            {list.first_name} shared these with you.{" "}
            {count === 0
              ? ""
              : count === 1
                ? "1 program coming up."
                : `${count} programs coming up.`}
          </p>
        </div>

        {count === 0 ? (
          <p className="rounded-card border border-line-card bg-surface p-6 text-xl text-fg-muted">
            Nothing coming up right now. Check back later, or see what else is on.
          </p>
        ) : (
          <ul className="flex flex-col gap-6">
            {list.events.map((ev) => {
              const calendar = googleCalendarUrl(ev);
              const when = whenLine(ev, { fixed: true });
              return (
                // The site's list card (member/CaregiverFeed): picture,
                // title and tags, when / where / saved, who posted it at
                // the bottom right; the whole card opens the program.
                <li
                  key={ev.id}
                  className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-4 rounded-card border border-line bg-surface p-4 transition-[border-color,box-shadow,background-color] hover:border-fg-icon-muted hover:bg-surface-subtle/40 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:gap-x-6 sm:p-5"
                >
                  <div className="relative col-span-2 aspect-[2/1] w-full overflow-hidden rounded-control bg-surface-subtle sm:col-span-1 sm:aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={eventImage(ev)}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                  <div className="col-span-2 flex min-w-0 flex-col gap-3 sm:col-span-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <h2 className="text-2xl font-medium leading-tight text-fg">
                        <Link
                          href={`/events/${ev.id}`}
                          className="after:absolute after:inset-0 after:rounded-card after:content-[''] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-border"
                        >
                          {ev.title}
                        </Link>
                      </h2>
                      <EventTags event={ev} />
                    </div>
                    <div className="flex flex-col gap-2 text-lg text-fg">
                      <p className="flex items-start gap-3">
                        <CalendarDays aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-fg-muted" />
                        <span>
                          {when.rel}
                          {when.date && ` · ${when.date}`}
                          {when.time && <span className="block text-fg-muted">{when.time}</span>}
                        </span>
                      </p>
                      <p className="flex items-start gap-3">
                        <MapPin aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-fg-muted" />
                        {placeLabel(ev)}
                      </p>
                      <GoingCount count={ev.saved_count} capacity={ev.capacity} />
                    </div>
                  </div>
                  {/* For people without an account, the one way to keep a
                      program: Google's prefilled event. */}
                  <div className="relative z-10 col-span-2 flex sm:col-span-1 sm:items-start">
                    {calendar && (
                      <a
                        href={calendar}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Add ${ev.title} to Google Calendar`}
                        title="Add to Google Calendar"
                        className="grid size-11 place-items-center rounded-control bg-surface-subtle transition-colors hover:bg-line-active"
                      >
                        <GoogleCalendarIcon />
                      </a>
                    )}
                  </div>
                  {ev.host_name && (
                    <p className="col-span-2 text-base text-fg-muted sm:absolute sm:bottom-5 sm:right-5 sm:col-span-1 sm:max-w-[45%] sm:text-right">
                      <PostedBy event={ev} />
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col items-center gap-4 rounded-card border border-line-card bg-surface p-6 text-center sm:p-8">
          <p className="text-xl">
            Find more programs for you around Kitchener-Waterloo.
          </p>
          <Link href="/" className={buttonClass("secondary", "lg")}>
            See all programs
          </Link>
        </div>
      </main>
    </div>
  );
}
