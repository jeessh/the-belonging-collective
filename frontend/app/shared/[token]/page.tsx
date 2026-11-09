import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";
import { SharedListView } from "@/components/SharedListView";
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
    <div className="min-h-dvh bg-surface text-fg">
      <PublicHeader />
      {/* The All Saved Events page, read-only (components/SharedListView). */}
      <main className="mx-auto w-full max-w-[928px] px-4 py-8 sm:px-6 sm:py-10">
        <SharedListView firstName={list.first_name} events={list.events} />
      </main>
    </div>
  );
}
