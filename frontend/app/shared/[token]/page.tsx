import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventSummary } from "@/components/ui/EventSummary";
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

  return (
    <main className="min-h-dvh bg-surface-subtle px-4 py-6 text-fg sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
        <h1 className="text-3xl font-medium">{list.first_name}&apos;s programs</h1>

        {list.events.length === 0 ? (
          <p className="rounded-card border border-line bg-surface p-6 text-xl text-fg-muted">
            Nothing coming up.
          </p>
        ) : (
          <ul className="grid gap-6">
            {list.events.map((ev) => (
              <li
                key={ev.id}
                className="rounded-card border border-line-card bg-surface p-6 transition-colors hover:bg-surface-subtle"
              >
                <Link href={`/events/${ev.id}`} className="block">
                  <EventSummary event={ev} layout="row" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="text-center text-lg">
          <Link href="/" className="text-fg underline underline-offset-4">
            See more programs
          </Link>
        </p>
      </div>
    </main>
  );
}
