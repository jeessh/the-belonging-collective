"use client";

import { useEffect, useState } from "react";
import { apiMessage, fetchEventAnalytics, type EventAnalytics } from "@/lib/api";
import { TIME_ZONE } from "@/lib/time";
import { EmptyRow, Pill, TableCard } from "@/components/AdminTable";
import { WeeklyChart } from "@/components/host/WeeklyChart";

/** "Oct 21, 2026" in Kitchener-Waterloo time. */
function shortDate(iso: string | null): string {
  if (!iso) return "No date";
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

const num = { fontVariantNumeric: "tabular-nums" } as const;

/**
 * The Analytics tab on an event's details page: the console's analytics
 * page for one event — tiles, the weekly chart (saves and clicks), and for
 * a repeating event each date's numbers. All time, since it was posted; the
 * same counting rules (a save later un-saved still counts).
 */
export function EventAnalyticsPanel({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchEventAnalytics(eventId)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(apiMessage(e, "Couldn't load the numbers.")));
    return () => {
      live = false;
    };
  }, [eventId]);

  if (error)
    return (
      <p role="alert" className="text-lg text-danger-fg">
        {error}
      </p>
    );
  if (!data) return <p className="text-lg text-fg-muted">Loading…</p>;

  const tiles = [
    { label: "Saved now", value: data.totals.going, note: "members who have it saved" },
    { label: "Saves", value: data.totals.saves, note: "including ones later un-saved" },
    { label: "Members who saved", value: data.totals.unique_savers, note: "unique people" },
    { label: "Registration clicks", value: data.totals.clicks, note: "links followed" },
  ];
  const repeating = data.dates.length > 1;

  return (
    <div className="flex max-w-[1200px] flex-col gap-8">
      <p className="text-base text-fg-muted">
        Since it was posted on {shortDate(data.posted_at)}
        {repeating ? `, across all ${data.dates.length} dates` : ""}.
      </p>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-1 rounded-control border border-line bg-surface p-4 sm:p-5"
          >
            <dt className="text-base text-fg-muted">{t.label}</dt>
            <dd className="text-4xl font-semibold text-fg sm:text-5xl" style={num}>
              {t.value.toLocaleString()}
            </dd>
            <dd className="text-base text-fg-muted">{t.note}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-labelledby="event-weekly-heading"
        className="rounded-control border border-line bg-surface p-4 sm:p-6"
      >
        <h2 id="event-weekly-heading" className="mb-4 text-2xl font-medium text-fg">
          Week by week
        </h2>
        <WeeklyChart weeks={data.weekly} keys={["saves", "clicks"]} />
      </section>

      {repeating && (
        <section
          aria-labelledby="event-dates-heading"
          className="rounded-control border border-line bg-surface p-4 sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="event-dates-heading" className="text-2xl font-medium text-fg">
              By date
            </h2>
            <p className="text-base text-fg-muted">
              &ldquo;Saved now&rdquo; is who has that date saved right now.
            </p>
          </div>
          <TableCard
            stackOnPhone={false}
            caption="Each date of this event with its saves, current attendance and registration clicks."
            head={["Date", "Saves", "Saved now", "Clicks"]}
          >
            {data.dates.length === 0 ? (
              <EmptyRow colSpan={4} text="No dates yet." />
            ) : (
              data.dates.map((d) => (
                <tr key={d.event_id} className="align-middle">
                  <th scope="row" className="whitespace-nowrap px-3 py-3 font-normal">
                    {shortDate(d.starts_at)}
                    {d.archived && (
                      <span className="ml-3">
                        <Pill tone="warn">Un-published</Pill>
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-3" style={num}>
                    {d.saves.toLocaleString()}
                  </td>
                  <td className="px-3 py-3" style={num}>
                    {d.going.toLocaleString()}
                  </td>
                  <td className="px-3 py-3" style={num}>
                    {d.clicks.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </TableCard>
        </section>
      )}
    </div>
  );
}
