import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventActions } from "@/components/EventActions";
import { EventDetails } from "@/components/member/EventDetails";
import { EventTools } from "@/components/member/EventTools";
import { GoingCount } from "@/components/ui/GoingCount";
import { fetchEvent, siteUrl } from "@/lib/serverApi";
import { hostnameOf } from "@/lib/share";
import type { Event } from "@/lib/api";

// Server-rendered on purpose. This is the page nonprofits paste into a Facebook
// post and the only thing a search engine can index — both need the content in
// the HTML, not behind a client fetch that runs after a cookie check.
//
// A short window because archiving a program has to take it off member-facing
// surfaces promptly: while a page is cached its outbound registration button
// still works, since that opens a URL the browser already holds rather than
// asking the backend. A minute of that is tolerable; five was not.
export const revalidate = 60;

type Params = { params: Promise<{ id: string }> };

function summarize(event: Event): string {
  const when = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString("en-CA", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const facts = [when, event.location, event.host_name].filter(Boolean);
  const lead = event.description?.trim();
  return lead ? `${facts.join(" · ")} — ${lead}`.slice(0, 300) : facts.join(" · ");
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const event = await fetchEvent(id);
  if (!event) return { title: "Program not found" };

  const description = summarize(event);
  const url = `${siteUrl()}/events/${event.id}`;
  const images = event.cover_image_url ? [event.cover_image_url] : undefined;

  return {
    title: event.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: event.title,
      description,
      url,
      type: "article",
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: event.title,
      description,
      images,
    },
  };
}

export default async function EventPage({ params }: Params) {
  const { id } = await params;
  const event = await fetchEvent(id);
  if (!event) notFound();

  const external =
    event.requires_signup &&
    event.registration_mode === "external" &&
    !!event.registration_url;

  // Search engines get the structured version; people get the page below.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || undefined,
    startDate: event.starts_at ?? undefined,
    endDate: event.ends_at ?? undefined,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: event.location
      ? { "@type": "Place", name: event.location }
      : undefined,
    image: event.cover_image_url ?? undefined,
    organizer: event.host_name
      ? { "@type": "Organization", name: event.host_name }
      : undefined,
    isAccessibleForFree: event.is_free,
    url: `${siteUrl()}/events/${event.id}`,
  };

  return (
    <main className="min-h-dvh bg-surface-subtle px-4 py-6 text-fg sm:px-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="mx-auto w-full max-w-[960px] rounded-card border border-line bg-surface p-6 sm:p-10">
        <EventDetails
          event={event}
          titleAs="h1"
          going={
            <GoingCount
              count={event.saved_count}
              signInHref={`/signup?next=${encodeURIComponent(`/events/${event.id}`)}`}
            />
          }
          tools={<EventTools event={event} />}
          hint={external ? hostnameOf(event.registration_url) : undefined}
          actions={
            // useSearchParams needs a boundary.
            <Suspense fallback={null}>
              <EventActions event={event} />
            </Suspense>
          }
        />

        <p className="mt-8 text-center text-lg">
          <Link href="/" className="text-fg underline underline-offset-4">
            See more programs
          </Link>
        </p>
      </article>
    </main>
  );
}
