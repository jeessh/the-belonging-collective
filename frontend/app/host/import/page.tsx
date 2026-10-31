"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarSearch, Upload } from "lucide-react";
import {
  apiMessage,
  commitCalendarImport,
  fetchAccessGroups,
  previewCalendarImport,
  type AccessGroup,
  type ImportProgram,
} from "@/lib/api";
import { longDate, timeRange } from "@/lib/time";
import { useCategories } from "@/lib/useCategories";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/host/PageHeader";
import { Pill, Select, TableCard } from "@/components/AdminTable";
import { Button, buttonClass } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/**
 * Import an organization's existing calendar (a Teamup, Google or Outlook
 * iCal feed, or an .ics file) as events. Superadmins only.
 *
 * Preview first — nothing is written until Import: map each of the
 * calendar's organizations to one here, check each program's topic and who
 * can see it, untick anything already here or not wanted. See
 * app/api/routes/imports.py.
 */
export default function ImportPage() {
  return <AdminShell requireSuperadmin>{() => <Importer />}</AdminShell>;
}

/** The mapping key for programs whose calendar names no organization. */
const NONE = "";
const SKIP = "skip";

type Row = { include: boolean; topic: string; groupId: string };

function Importer() {
  const { categories, label: topicLabel } = useCategories();
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<ImportProgram[] | null>(null);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ programs: number; events: number } | null>(null);

  useEffect(() => {
    fetchAccessGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

  async function runPreview() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await previewCalendarImport(file ? { ics: file.text } : { url });
      setPrograms(res.programs);
      setOrgs(res.organizations);
      // One choice per calendar organization, starting from what matched.
      const map: Record<string, string> = {};
      for (const p of res.programs) {
        const k = p.org_label ?? NONE;
        if (!(k in map)) map[k] = p.host_id ?? "";
      }
      setOrgMap(map);
      setRows(
        Object.fromEntries(
          res.programs.map((p) => [
            p.key,
            { include: !p.duplicate, topic: p.categories[0] ?? "", groupId: "" },
          ]),
        ),
      );
    } catch (e) {
      setError(apiMessage(e, "Couldn't read that calendar."));
      setPrograms(null);
    } finally {
      setBusy(false);
    }
  }

  const hostOf = (p: ImportProgram) => orgMap[p.org_label ?? NONE] ?? "";
  const labels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of programs ?? []) {
      const k = p.org_label ?? NONE;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [programs]);

  const chosen = (programs ?? []).filter((p) => rows[p.key]?.include);
  const ready = chosen.filter((p) => {
    const host = hostOf(p);
    return host && host !== SKIP && rows[p.key].topic;
  });
  const notReady = chosen.length - ready.length;
  const dateCount = ready.reduce((n, p) => n + p.dates.length, 0);

  async function runImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await commitCalendarImport(
        ready.map((p) => {
          const row = rows[p.key];
          return {
            title: p.title,
            description: p.description,
            location: p.location,
            who: p.who,
            host_id: hostOf(p),
            // The guesses as they were, or the one topic picked instead.
            categories: row.topic === p.categories[0] ? p.categories : [row.topic],
            dates: p.dates,
            recurrence: p.recurrence,
            links: p.links,
            is_free: p.is_free,
            is_virtual: p.is_virtual,
            min_age: p.min_age,
            access_group_id: row.groupId || null,
          };
        }),
      );
      setResult(res);
      setPrograms(null);
    } catch (e) {
      setError(apiMessage(e, "Couldn't import those events."));
    } finally {
      setImporting(false);
    }
  }

  const setRow = (key: string, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [key]: { ...r[key], ...patch } }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Import events"
        subtitle="From an organization's existing calendar — nothing is added until you press Import"
        backHref="/host/events"
      />

      <section className="flex max-w-[1026px] flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-xl font-medium text-fg">Calendar</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <TextField
            label="Calendar address"
            className="flex-1"
            placeholder="https://ics.teamup.com/feed/… (Teamup, Google or Outlook)"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setFile(null);
            }}
            autoComplete="off"
          />
          <span className="text-sm text-fg-muted sm:pb-2">or</span>
          <Button leadingIcon={<Upload />} onClick={() => fileRef.current?.click()}>
            {file ? file.name : "Upload .ics file"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void f.text().then((text) => {
                setFile({ name: f.name, text });
                setUrl("");
              });
            }}
          />
          <Button
            variant="primary"
            leadingIcon={<CalendarSearch />}
            disabled={busy || (!url.trim() && !file)}
            onClick={() => void runPreview()}
          >
            {busy ? "Reading…" : "Preview"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-base text-danger-fg">
            {error}
          </p>
        )}
      </section>

      {result && (
        <div
          role="status"
          className="flex max-w-[1026px] flex-wrap items-center gap-4 rounded-control border-[3px] border-toast-success bg-tag-free-bg px-5 py-3 text-lg text-fg"
        >
          <span className="flex-1">
            Imported {result.programs} {result.programs === 1 ? "event" : "events"} (
            {result.events.toLocaleString()} dates) — they&apos;re published now
          </span>
          <Link href="/host/events" className={buttonClass("secondary")}>
            See them in Event Management
          </Link>
        </div>
      )}

      {programs && (
        <>
          <p className="text-lg text-fg">
            {programs.length} upcoming {programs.length === 1 ? "event" : "events"} ·{" "}
            {programs.reduce((n, p) => n + p.dates.length, 0).toLocaleString()} dates
          </p>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-medium text-fg">Organizations</h2>
            <TableCard
              caption="Each organization in the calendar, and which organization here its events go under"
              head={["In the calendar", "Events", "Goes under"]}
            >
              {labels.map(([label, count]) => (
                <tr key={label || "none"} className="align-middle">
                  <th scope="row" className="px-3 py-3 font-normal">
                    {label || <span className="text-fg-muted">No organization given</span>}
                  </th>
                  <td className="px-3 py-3">{count}</td>
                  <td className="px-3 py-3">
                    <Select
                      aria-label={`Organization for ${label || "events with none"}`}
                      value={orgMap[label] ?? ""}
                      onChange={(e) => setOrgMap((m) => ({ ...m, [label]: e.target.value }))}
                    >
                      <option value="">Choose an organization</option>
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                      <option value={SKIP}>Don&apos;t import these</option>
                    </Select>
                  </td>
                </tr>
              ))}
            </TableCard>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-medium text-fg">Events</h2>
            <TableCard
              caption="Each event in the calendar: whether to import it, when it is, its topic and who can see it"
              head={["Import", "Event", "When", "Topic", "Who can see it", "Check"]}
            >
              {programs.map((p) => {
                const row = rows[p.key];
                const host = hostOf(p);
                const skipped = host === SKIP;
                const first = p.dates[0];
                const orgGroups = groups.filter((g) => g.host_id === host);
                const notes = [
                  ...(p.duplicate ? ["Already here"] : []),
                  ...(!host ? ["Needs an organization"] : []),
                  ...(!row.topic ? ["Needs a topic"] : []),
                  ...(p.restricted && !row.groupId ? ["Restricted audience"] : []),
                ];
                return (
                  <tr key={p.key} className={`align-top ${skipped ? "opacity-50" : ""}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary-border"
                        aria-label={`Import ${p.title}`}
                        checked={row.include && !skipped}
                        disabled={skipped}
                        onChange={(e) => setRow(p.key, { include: e.target.checked })}
                      />
                    </td>
                    <th scope="row" className="max-w-[320px] px-3 py-3 font-normal">
                      <span className="block font-medium">{p.title}</span>
                      {p.who && <span className="block text-fg-muted">{p.who}</span>}
                      {p.location && <span className="block text-fg-muted">{p.location}</span>}
                    </th>
                    <td className="px-3 py-3">
                      <span className="block whitespace-nowrap">{longDate(first.starts_at)}</span>
                      <span className="block whitespace-nowrap text-fg-muted">
                        {timeRange(first.starts_at, first.ends_at)}
                      </span>
                      {p.dates.length > 1 && (
                        <span className="block text-fg-muted">
                          {p.recurrence ?? "Repeats"} · {p.dates.length} dates
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Select
                        aria-label={`Topic for ${p.title}`}
                        value={row.topic}
                        onChange={(e) => setRow(p.key, { topic: e.target.value })}
                      >
                        <option value="">Pick a topic</option>
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                      {row.topic === p.categories[0] && p.categories[1] && (
                        <span className="mt-1 block text-fg-muted">
                          + {topicLabel(p.categories[1])}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Select
                        aria-label={`Who can see ${p.title}`}
                        value={row.groupId}
                        disabled={!host || skipped}
                        onChange={(e) => setRow(p.key, { groupId: e.target.value })}
                      >
                        <option value="">Everyone</option>
                        {orgGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            Special access — {g.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex flex-col items-start gap-1">
                        {notes.map((n) => (
                          <Pill key={n} tone={n === "Already here" ? "neutral" : "warn"}>
                            {n}
                          </Pill>
                        ))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </TableCard>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-4 border-t border-line pt-5">
            {notReady > 0 && (
              <span className="text-base text-fg-muted">
                {notReady} ticked {notReady === 1 ? "event needs" : "events need"} an
                organization or topic first
              </span>
            )}
            <Button
              variant="primary"
              disabled={importing || ready.length === 0}
              onClick={() => void runImport()}
            >
              {importing
                ? "Importing…"
                : `Import ${ready.length} ${ready.length === 1 ? "event" : "events"} (${dateCount.toLocaleString()} dates)`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
