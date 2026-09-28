"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Printer, SlidersHorizontal } from "lucide-react";
import { ApiError, api, type Event } from "@/lib/api";
import { DIMENSIONS } from "@/lib/dimensions";
import { oneCardPerProgram } from "@/lib/feed";
import { isUpcoming } from "@/lib/time";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { AdminShell, type ConsoleContext } from "@/components/AdminShell";
import { Modal } from "@/components/Modal";
import { SearchField } from "@/components/AdminTable";
import { Button, buttonClass } from "@/components/ui/Button";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { useToast } from "@/components/ui/Toast";
import { PosterSheet, WeeklySheet, printSheet } from "@/components/host/PrintSheets";
import { AdminEventCard } from "@/components/host/AdminEventCard";
import { UnpublishModal, unpublishedToast } from "@/components/host/UnpublishModal";
import {
  FilterPanel,
  NO_HOST_FILTERS,
  applyHostFilters,
  type HostFilters,
} from "@/components/host/PostedEvents";

export default function ProgramsPage() {
  return <AdminShell>{(ctx) => <PostedEvents ctx={ctx} />}</AdminShell>;
}

type Scope = "mine" | "all";

function PostedEvents({ ctx }: { ctx: ConsoleContext }) {
  const router = useRouter();
  const { show } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<HostFilters>(NO_HOST_FILTERS);
  // Below `lg` the filter panel lives in a sheet behind a Filters button.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Rotating a tablet past `lg` shows the panel, so the sheet must not linger.
  const wide = useMediaQuery("(min-width: 1024px)");
  const [unpublishing, setUnpublishing] = useState<Event | null>(null);
  // The one program whose poster sheet is mounted, just long enough to print.
  const [printing, setPrinting] = useState<Event | null>(null);
  const chosen = DIMENSIONS.reduce(
    (n, d) => n + (filters[d.key]?.length ?? 0),
    0,
  );

  async function load() {
    const PAGE = 200;
    const all: Event[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await api<Event[]>(`/events?limit=${PAGE}&offset=${offset}`);
      all.push(...page);
      if (page.length < PAGE) break;
    }
    return all;
  }

  useEffect(() => {
    let alive = true;
    load()
      .then((all) => {
        if (!alive) return;
        setEvents(all);
        setLoadError(false);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/host");
          return;
        }
        setLoadError(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [router]);

  // "Your Events" is a client-side cut on host_id: the console already holds
  // the whole calendar for the filters, so there is nothing to refetch.
  const inScope = useMemo(
    () =>
      scope === "mine"
        ? events.filter((ev) => ev.host_id === ctx.org.id)
        : events,
    [events, scope, ctx.org.id],
  );

  // One row per program, not one per date, shown at its next date. Upcoming
  // occurrences go first so the card carries the date staff can still act on;
  // a run that has finished falls back to its first date. Filters and search
  // apply first, so a filter that matches only some dates still surfaces the
  // program.
  const shown = useMemo(() => {
    const matching = applyHostFilters(inScope, filters, query);
    return oneCardPerProgram([
      ...matching.filter(isUpcoming),
      ...matching.filter((ev) => !isUpcoming(ev)),
    ]);
  }, [inScope, filters, query]);

  const nothingPosted = !loading && scope === "mine" && inScope.length === 0;

  // The printed week: every dated session in the next seven days for the
  // organization in view — your own under "Your Events", otherwise whichever
  // the organization filter names (all of them when it names none).
  const week = useMemo(() => {
    const from = new Date();
    const to = new Date(from.getTime() + 7 * 86_400_000);
    const orgs = filters.org ?? [];
    const rows = inScope
      .filter((ev) => scope === "mine" || orgs.length === 0 || orgs.includes(ev.host_name))
      .filter((ev) => {
        if (!ev.starts_at) return false;
        const at = new Date(ev.starts_at).getTime();
        return at >= from.getTime() && at <= to.getTime();
      })
      .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!));
    const orgName =
      scope === "mine"
        ? ctx.org.name
        : orgs.length === 1
          ? orgs[0]
          : "The Belonging Collective";
    return { from, to, rows, orgName };
  }, [inScope, filters.org, scope, ctx.org.name]);

  // Un-publishing retires every date of the program; Undo puts them back.
  // The list is patched in place either way — the whole calendar is a slow
  // fetch, and the card should leave the moment the dialog closes.
  function retired(program: Event) {
    const gone = (ev: Event) =>
      ev.id === program.id || (!!program.series_id && ev.series_id === program.series_id);
    const removed = events.filter(gone);
    setEvents((all) => all.filter((ev) => !gone(ev)));
    unpublishedToast(show, program, () =>
      setEvents((all) => [...all, ...removed.filter((r) => !all.some((a) => a.id === r.id))]),
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-medium text-fg sm:text-5xl">
          {scope === "mine" ? "Your Events" : "All Events"}
        </h1>
        <SegmentedToggle<Scope>
          label="Which events"
          value={scope}
          onChange={(next) => {
            setScope(next);
            // The options are drawn from the events in scope, so a choice
            // made under one scope may not exist under the other.
            setFilters(NO_HOST_FILTERS);
          }}
          segments={[
            { value: "mine", label: "Your Events" },
            { value: "all", label: "All Events" },
          ]}
        />
      </div>

      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="hidden w-[431px] shrink-0 lg:block">
          <FilterPanel events={inScope} filters={filters} onChange={setFilters} />
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <SearchField
              label="Search for event"
              placeholder="Search for event"
              value={query}
              onChange={setQuery}
              className="w-full sm:max-w-[428px]"
            />
            <div className="flex flex-wrap gap-3 max-sm:[&>*]:flex-1">
              <Button
                className="lg:hidden"
                leadingIcon={<SlidersHorizontal />}
                aria-haspopup="dialog"
                onClick={() => setFiltersOpen(true)}
              >
                Filters{chosen > 0 && ` (${chosen})`}
              </Button>
              <Button
                leadingIcon={<Printer />}
                disabled={loading}
                onClick={() => printSheet(document.getElementById("weekly-list"))}
              >
                Print this week
              </Button>
              <Link href="/host/events/new" className={buttonClass("primary")}>
                Create new event
                <Plus aria-hidden="true" className="size-6" />
              </Link>
            </div>
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {loading
              ? "Loading events"
              : `${shown.length} of ${oneCardPerProgram(inScope).length} programs shown`}
          </p>

          {loadError ? (
            <p role="alert" className="text-lg text-danger-fg">
              Couldn&apos;t load events. Please refresh and try again.
            </p>
          ) : loading ? (
            <p className="text-lg text-fg-muted">Loading…</p>
          ) : nothingPosted ? (
            <div className="flex min-h-[600px] flex-col items-center justify-center gap-3 rounded-card border border-line bg-surface p-8 text-center">
              <p className="text-3xl font-medium text-fg">
                You haven&apos;t posted any events yet!
              </p>
              <p className="text-xl text-fg-muted">
                Everything you publish shows up here and in the member feed.
              </p>
              <Link
                href="/host/events/new"
                className={buttonClass("primary", "lg", "mt-4 w-full max-w-[548px]")}
              >
                Create New Event
                <Plus aria-hidden="true" className="size-6" />
              </Link>
            </div>
          ) : shown.length === 0 ? (
            <p className="text-xl text-fg-muted">
              Nothing matches those filters.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {shown.map((ev) => (
                <AdminEventCard
                  key={ev.id}
                  event={ev}
                  canManage={ctx.isSuper || ev.host_id === ctx.org.id}
                  onUnpublish={setUnpublishing}
                  onPrint={setPrinting}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <WeeklySheet
        id="weekly-list"
        events={week.rows}
        orgName={week.orgName}
        logoUrl={
          scope === "mine" || week.orgName === ctx.org.name ? ctx.org.logo_url : null
        }
        from={week.from}
        to={week.to}
      />
      {printing && (
        <PosterSheet
          id="card-poster"
          event={printing}
          onReady={() => {
            printSheet(document.getElementById("card-poster"));
            setPrinting(null);
          }}
        />
      )}

      {filtersOpen && !wide && (
        <Modal title="Filters" onClose={() => setFiltersOpen(false)}>
          <div className="mt-4">
            <FilterPanel
              events={inScope}
              filters={filters}
              onChange={setFilters}
            />
          </div>
          <Button
            variant="primary"
            size="lg"
            className="mt-6 w-full"
            onClick={() => setFiltersOpen(false)}
          >
            Show {shown.length} {shown.length === 1 ? "program" : "programs"}
          </Button>
        </Modal>
      )}

      {unpublishing && (
        <UnpublishModal
          event={unpublishing}
          onClose={() => setUnpublishing(null)}
          onDone={() => {
            const program = unpublishing;
            setUnpublishing(null);
            retired(program);
          }}
        />
      )}
    </div>
  );
}
