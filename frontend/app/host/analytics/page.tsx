"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, CalendarDays, Download } from "lucide-react";
import {
  ApiError,
  analyticsCsvUrl,
  apiMessage,
  fetchAnalytics,
  listAdmins,
  type AdminAccount,
  type Analytics,
  type AnalyticsProgram,
} from "@/lib/api";
import { TIME_ZONE } from "@/lib/time";
import { AdminShell, type ConsoleContext } from "@/components/AdminShell";
import { Button, buttonClass } from "@/components/ui/Button";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { TextField } from "@/components/ui/TextField";
import { EmptyRow, Field, Pill, Select, TableCard } from "@/components/AdminTable";
import { WeeklyChart } from "@/components/host/WeeklyChart";

/**
 * Analytics: the adoption numbers an agency puts in a grant application.
 *
 * Saves (a member keeping a program), registration-link clicks (the last
 * step we can see when sign-up happens on the agency's own site) and
 * programs posted, over a date range. One filter row scopes everything on
 * the page — tiles, chart and table all read the same slice — and the CSV
 * is those same numbers, for the application itself.
 */
export default function AnalyticsPage() {
  return <AdminShell>{(ctx) => <AnalyticsView ctx={ctx} />}</AdminShell>;
}

type Preset = "30" | "90" | "year" | "custom";

/** YYYY-MM-DD in Toronto, which is what the API counts days in. */
function isoDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function presetRange(p: Preset): { from: string; to: string } | null {
  const to = isoDate(new Date());
  if (p === "30") return { from: daysAgo(30), to };
  if (p === "90") return { from: daysAgo(90), to };
  if (p === "year") return { from: `${to.slice(0, 4)}-01-01`, to };
  return null;
}

/** "Sep 27, 2026" from an ISO timestamp, in Toronto. */
function shortDate(iso?: string | null): string {
  if (!iso) return "Date to be announced";
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type SortKey = "saves" | "going" | "clicks" | "title" | "starts_at";

function AnalyticsView({ ctx }: { ctx: ConsoleContext }) {
  const router = useRouter();
  const [preset, setPreset] = useState<Preset>("90");
  const [custom, setCustom] = useState({
    from: daysAgo(90),
    to: isoDate(new Date()),
  });
  const [orgId, setOrgId] = useState<string>("");
  const [orgs, setOrgs] = useState<AdminAccount[]>([]);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("saves");

  const range = presetRange(preset) ?? custom;
  const params = { ...range, host_id: orgId || undefined };

  useEffect(() => {
    if (ctx.isSuper)
      listAdmins()
        .then(setOrgs)
        .catch(() => {});
  }, [ctx.isSuper]);

  useEffect(() => {
    let alive = true;
    // A bad custom range (from after to) is left alone until it makes sense.
    if (range.from > range.to) return;
    setLoading(true);
    fetchAnalytics(params)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/host");
          return;
        }
        setError(apiMessage(e, "Couldn't load the numbers. Please try again."));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, orgId, router]);

  const programs = useMemo(() => {
    const rows = [...(data?.programs ?? [])];
    const by: Record<
      SortKey,
      (a: AnalyticsProgram, b: AnalyticsProgram) => number
    > = {
      saves: (a, b) => b.saves - a.saves || b.clicks - a.clicks,
      going: (a, b) => b.going - a.going || b.saves - a.saves,
      clicks: (a, b) => b.clicks - a.clicks || b.saves - a.saves,
      title: (a, b) => a.title.localeCompare(b.title),
      starts_at: (a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""),
    };
    return rows.sort(by[sort]);
  }, [data, sort]);

  const tiles = data
    ? [
        {
          label: "Saves",
          value: data.totals.saves,
          note: "including ones later un-saved",
        },
        {
          label: "Members who saved",
          value: data.totals.unique_savers,
          note: "unique people",
        },
        {
          label: "Registration clicks",
          value: data.totals.clicks,
          note: "links followed",
        },
        {
          label: "Programs posted",
          value: data.totals.postings,
          note: "a repeating program counts once",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-[840px] flex-col gap-3">
          <h1 className="text-4xl font-medium text-fg sm:text-5xl">
            Analytics
          </h1>
          <p className="text-xl text-fg">
            How members are finding and keeping{" "}
            {ctx.isSuper && !orgId
              ? "programs"
              : `${data?.host_name ?? ctx.org.name}'s programs`}
            . These are the numbers for a grant application: download them as a
            spreadsheet with the range you need.
          </p>
        </div>
        <a
          href={analyticsCsvUrl(params)}
          download
          className={buttonClass("primary")}
        >
          Download CSV
          <Download aria-hidden="true" className="size-6" />
        </a>
      </div>

      {/* One filter row; everything below reads the same slice. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        {/* Four presets don't fit a phone side by side; the row scrolls. */}
        <div className="max-w-full overflow-x-auto scroll-fade-x">
          <SegmentedToggle<Preset>
            label="Date range"
            value={preset}
            onChange={(next) => {
              if (next === "custom") setCustom(presetRange(preset) ?? custom);
              setPreset(next);
            }}
            segments={[
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
              { value: "year", label: "This year" },
              { value: "custom", label: "Custom" },
            ]}
          />
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              label="From"
              placeholder="YYYY-MM-DD"
              type="date"
              icon={<CalendarDays />}
              value={custom.from}
              max={custom.to}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
            />
            <TextField
              label="To"
              placeholder="YYYY-MM-DD"
              type="date"
              icon={<CalendarDays />}
              value={custom.to}
              min={custom.from}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
            />
          </div>
        )}
        {ctx.isSuper && (
          <Field label="Organization" className="w-full sm:w-80 lg:ml-auto">
            <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">All organizations</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {error && (
        <p role="alert" className="text-lg text-danger-fg">
          {error}
        </p>
      )}

      {/* While a new range loads the last render stays, dimmed — no jump. */}
      <div
        aria-busy={loading}
        className={`flex flex-col gap-8 transition-opacity ${loading ? "opacity-50" : ""}`}
      >
        {!data ? (
          <p className="text-lg text-fg-muted">Loading…</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {tiles.map((t) => (
                <div
                  key={t.label}
                  className="flex flex-col gap-1 rounded-control border border-line bg-surface p-4 sm:p-5"
                >
                  <dt className="text-base text-fg-muted">{t.label}</dt>
                  <dd className="text-4xl font-semibold text-fg sm:text-5xl">
                    {t.value.toLocaleString()}
                  </dd>
                  <dd className="text-base text-fg-muted">{t.note}</dd>
                </div>
              ))}
            </dl>

            <section
              aria-labelledby="weekly-heading"
              className="rounded-control border border-line bg-surface p-4 sm:p-6"
            >
              <h2
                id="weekly-heading"
                className="mb-4 text-2xl font-medium text-fg"
              >
                Week by week
              </h2>
              <WeeklyChart weeks={data.weekly} />
            </section>

            <section
              aria-labelledby="programs-heading"
              className="rounded-control border border-line bg-surface p-4 sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <h2
                  id="programs-heading"
                  className="text-2xl font-medium text-fg"
                >
                  By program
                </h2>
                <p className="text-base text-fg-muted">
                  Programs posted in the range, or saved or clicked during it.
                  &ldquo;Going&rdquo; is who has it saved right now.
                </p>
              </div>
              <TableCard
                caption="Each program with its saves, current attendance and registration clicks in the chosen range. Sortable by column."
                head={[]}
              >
                <tr className="text-fg">
                  {(
                    [
                      ["title", "Program", "text-left"],
                      ["starts_at", "First date", "text-left"],
                      ...(ctx.isSuper && !orgId
                        ? [["org", "Organization", "text-left"] as const]
                        : []),
                      ["saves", "Saves", "text-right"],
                      ["going", "Going", "text-right"],
                      ["clicks", "Clicks", "text-right"],
                    ] as const
                  ).map(([key, label, align]) => (
                    <th
                      key={key}
                      scope="col"
                      aria-sort={sort === key ? "descending" : undefined}
                      className={`whitespace-nowrap px-3 pb-3 font-normal ${align}`}
                    >
                      {key === "org" ? (
                        label
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSort(key)}
                          className="inline-flex min-h-11 items-center gap-1 rounded-control"
                        >
                          {label}
                          {sort === key && (
                            <ArrowDown aria-hidden="true" className="size-4" />
                          )}
                          <span className="sr-only">
                            {sort === key ? " (sorted)" : " — sort by this"}
                          </span>
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
                {programs.length === 0 ? (
                  <EmptyRow
                    colSpan={6}
                    text="Nothing happened in this range yet."
                  />
                ) : (
                  programs.map((p) => (
                    <tr key={p.program_id} className="align-middle">
                      <th scope="row" className="px-3 py-3 font-normal">
                        <Link
                          href={`/host/events/${p.event_id}`}
                          className="underline decoration-line underline-offset-4 hover:decoration-fg"
                        >
                          {p.title}
                        </Link>
                        {p.archived && (
                          <span className="ml-3">
                            <Pill tone="warn">Archived</Pill>
                          </span>
                        )}
                      </th>
                      <td className="whitespace-nowrap px-3 py-3">
                        {shortDate(p.starts_at)}
                      </td>
                      {ctx.isSuper && !orgId && (
                        <td className="px-3 py-3">{p.host_name}</td>
                      )}
                      <td
                        className="px-3 py-3 text-right"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {p.saves.toLocaleString()}
                      </td>
                      <td
                        className="px-3 py-3 text-right"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {p.going.toLocaleString()}
                      </td>
                      <td
                        className="px-3 py-3 text-right"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {p.clicks.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </TableCard>
            </section>
          </>
        )}
      </div>

      {data && (
        <p className="text-base text-fg-muted">
          Counting {data.from} to {data.to}. Saves count every time a member
          kept a program, even if they later removed it; programs un-published
          since still count for what happened while they were up.
          <Button
            variant="ghost"
            className="ml-2"
            onClick={() => setSort("saves")}
          >
            Reset sort
          </Button>
        </p>
      )}
    </div>
  );
}
