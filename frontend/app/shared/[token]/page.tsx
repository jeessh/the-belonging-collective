import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { buttonClass } from "@/components/ui/Button";
import { EventSummary } from "@/components/ui/EventSummary";
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
    <div className="min-h-dvh bg-surface-subtle text-fg">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
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
              return (
                <li
                  key={ev.id}
                  className="rounded-card border border-line-card bg-surface p-6"
                >
                  <EventSummary event={ev} layout="row" fixedDates />
                  {/* Under the row rather than in its third column, which
                      squeezed the title and facts into a narrow strip. */}
                  <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-line-card pt-6">
                    {calendar && (
                      <a
                        href={calendar}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClass("secondary", "md")}
                      >
                        Add to Google Calendar
                        <GoogleCalendarIcon />
                      </a>
                    )}
                    <Link
                      href={`/events/${ev.id}`}
                      className={buttonClass("primary", "md")}
                    >
                      See details
                      <ArrowRight aria-hidden="true" className="size-6" />
                    </Link>
                  </div>
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
