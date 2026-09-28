"use client";

import { useId, useRef, useState } from "react";
import type { AnalyticsWeek } from "@/lib/api";
import { useMediaQuery } from "@/lib/useMediaQuery";

/**
 * Saves, registration-link clicks and postings per week, as one line chart.
 *
 * Inline SVG, drawn to the dataviz method: 2px lines, 8px end markers with a
 * surface ring, hairline gridlines, a legend for the three series plus a
 * label at each line's end, and a crosshair that reads every series at the
 * hovered week. The values are all reachable without hovering — the same
 * numbers sit in the table under the chart.
 *
 * Series colours are the validated categorical slots 1–3 (blue, orange,
 * aqua): adjacent-pair CVD ΔE 9.2 on the console's white surface.
 */

type SeriesKey = "saves" | "clicks" | "postings";

export const SERIES: {
  key: SeriesKey;
  label: string;
  /** The word after the number in an end label: "1 save", "6 posted". */
  short: (n: number) => string;
  color: string;
}[] = [
  {
    key: "saves",
    label: "Saves",
    short: (n) => (n === 1 ? "save" : "saves"),
    color: "#2a78d6",
  },
  {
    key: "clicks",
    label: "Registration clicks",
    short: (n) => (n === 1 ? "click" : "clicks"),
    color: "#eb6834",
  },
  {
    key: "postings",
    label: "Programs posted",
    short: () => "posted",
    color: "#1baf7a",
  },
];

const H = 280;

/** "Jul 6" — axis and tooltip dates, from a YYYY-MM-DD week start. */
function shortWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

/** Round the axis top to a clean number so the ticks read as 0 / 5 / 10. */
function niceMax(max: number): number {
  if (max <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(max));
  const unit = max / pow;
  const step = unit <= 2 ? 2 : unit <= 5 ? 5 : 10;
  return Math.ceil(max / (pow * (step / 5))) * (pow * (step / 5));
}

export function WeeklyChart({ weeks }: { weeks: AnalyticsWeek[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const titleId = useId();
  // The SVG scales to its box, so on a phone a 720-wide drawing shrinks its
  // text to nothing. Draw narrower there, and let the legend and tooltip
  // carry what the end labels would have.
  const wide = useMediaQuery("(min-width: 640px)");
  const W = wide ? 720 : 360;
  const PAD = { top: 16, right: wide ? 84 : 16, bottom: 36, left: 40 };

  if (weeks.length === 0) return null;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const max = niceMax(
    Math.max(1, ...weeks.flatMap((w) => [w.saves, w.clicks, w.postings])),
  );
  const x = (i: number) =>
    PAD.left +
    (weeks.length === 1 ? plotW / 2 : (i / (weeks.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max].map(Math.round);
  // Roughly one x label every ~90px; the first and last always.
  const every = Math.max(1, Math.ceil(weeks.length / (plotW / 90)));

  function pick(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < weeks.length; i++) {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    }
    setHover(best);
  }

  const last = weeks.length - 1;
  // End labels, nudged apart when two lines finish close together so a label
  // never sits on another line.
  const ends = SERIES.map((s) => ({ ...s, y: y(weeks[last][s.key]) })).sort(
    (a, b) => a.y - b.y,
  );
  for (let i = 1; i < ends.length; i++) {
    if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
  }

  const h = hover === null ? null : weeks[hover];

  return (
    <figure className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-base text-fg">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-labelledby={titleId}
          className="block h-auto w-full touch-pan-y select-none"
          onPointerMove={(e) => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(last)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft")
              setHover((i) => Math.max(0, (i ?? last) - 1));
            if (e.key === "ArrowRight")
              setHover((i) => Math.min(last, (i ?? -1) + 1));
          }}
          tabIndex={0}
        >
          <title id={titleId}>
            Saves, registration clicks and programs posted per week
          </title>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="#E1E0D9"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                dy="0.35em"
                textAnchor="end"
                fontSize={12}
                fill="#6D6D6D"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {t.toLocaleString()}
              </text>
            </g>
          ))}
          {weeks.map((w, i) =>
            i % every === 0 || i === last ? (
              <text
                key={w.week}
                x={x(i)}
                y={H - PAD.bottom + 20}
                textAnchor={i === last ? "end" : i === 0 ? "start" : "middle"}
                fontSize={12}
                fill="#6D6D6D"
              >
                {shortWeek(w.week)}
              </text>
            ) : null,
          )}

          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="#BABABA"
              strokeWidth={1}
            />
          )}

          {SERIES.map((s) => (
            <path
              key={s.key}
              d={weeks
                .map((w, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(w[s.key])}`)
                .join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {/* Markers only at the end and under the crosshair: a dot on every
              point of three series is noise. The 2px white ring keeps a dot
              legible where it crosses another line. */}
          {SERIES.map((s) =>
            [last, hover].map((i) =>
              i === null ? null : (
                <circle
                  key={`${s.key}-${i}`}
                  cx={x(i)}
                  cy={y(weeks[i][s.key])}
                  r={4}
                  fill={s.color}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              ),
            ),
          )}
          {wide &&
            ends.map((s) => (
              <text
                key={s.key}
                x={W - PAD.right + 12}
                y={s.y}
                dy="0.35em"
                fontSize={12}
                fill="#1A1A1A"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {weeks[last][s.key].toLocaleString()}{" "}
                {s.short(weeks[last][s.key])}
              </text>
            ))}
        </svg>

        {h && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-control border border-line bg-surface px-3 py-2 text-base shadow-sm"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform:
                x(hover) > W / 2
                  ? "translateX(calc(-100% - 12px))"
                  : "translateX(12px)",
            }}
          >
            <p className="text-fg-muted">Week of {shortWeek(h.week)}</p>
            {SERIES.map((s) => (
              <p
                key={s.key}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-4 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <strong
                  className="text-fg"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {h[s.key].toLocaleString()}
                </strong>
                <span className="text-fg-muted">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <details className="text-lg text-fg">
        <summary className="cursor-pointer text-fg-muted">
          Weekly numbers as a table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-base">
            <thead>
              <tr>
                <th scope="col" className="px-2 pb-2 font-normal">
                  Week of
                </th>
                {SERIES.map((s) => (
                  <th
                    key={s.key}
                    scope="col"
                    className="px-2 pb-2 text-right font-normal"
                  >
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-active border-t border-line-active">
              {weeks.map((w) => (
                <tr key={w.week}>
                  <th scope="row" className="px-2 py-1.5 font-normal">
                    {shortWeek(w.week)}
                  </th>
                  {SERIES.map((s) => (
                    <td
                      key={s.key}
                      className="px-2 py-1.5 text-right"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {w[s.key].toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
