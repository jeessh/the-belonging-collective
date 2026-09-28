/**
 * The feed's one loading screen. The home page shows it while it learns who
 * is signed in, then EventsView while the programs arrive; both draw this, so
 * the hand-over between them can't be seen. They used to draw two different
 * screens, one after the other.
 */
export function FeedLoading() {
  return (
    <main className="grid h-dvh place-items-center bg-surface text-fg-muted">
      <p className="text-2xl">Loading programs…</p>
    </main>
  );
}
