"use client";

import { Fragment, useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Event } from "@/lib/api";
import { TIME_ZONE, longDate, timeRange } from "@/lib/time";
import { repeatLabel } from "@/lib/recurrence";
import { eventUrl } from "@/components/CopyLinkButton";

/**
 * Sheets the console composes for the wall, from program data alone — no
 * upload, no backend. Each is a hidden block that `printSheet` marks as the
 * `.print-target` (globals.css hides everything else), prints, and hides
 * again. Sized for Letter (`@page` in globals.css); every line is 14pt or
 * larger, since these are read from across a room.
 */

/** A QR code as inline SVG for `target`; empty until drawn. */
export function useQrSvg(target: string): string {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    if (!target) return;
    QRCode.toString(target, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [target]);
  return svg;
}

/** The same trick as the details page's Print: mark, print, put back. */
export function printSheet(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove("hidden");
  el.classList.add("print-target");
  window.print();
  el.classList.add("hidden");
  el.classList.remove("print-target");
}

/** "the-belonging-collective.vercel.app/events/…" — the address without the scheme. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function OrgLine({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <div className="flex items-center gap-3">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-14 rounded-control object-cover" />
      )}
      <span style={{ fontSize: "18pt" }} className="font-medium">
        {name}
      </span>
    </div>
  );
}

function Footer() {
  return (
    <p
      style={{ fontSize: "14pt" }}
      className="mt-auto border-t border-line pt-3 text-center text-fg-muted"
    >
      The Belonging Collective
    </p>
  );
}

/**
 * One program on one page: cover, title, when, where, who runs it, and a QR
 * code to the program's public page. Offered whether or not the agency
 * attached a flyer of their own.
 */
export function PosterSheet({
  id,
  event,
  onReady,
}: {
  id: string;
  event: Event;
  /** Called once the QR code is drawn — the list mounts a sheet only to print it. */
  onReady?: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(eventUrl(event.id)), [event.id]);
  const svg = useQrSvg(url);
  useEffect(() => {
    if (svg) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg]);
  const when = [longDate(event.starts_at), timeRange(event.starts_at, event.ends_at)]
    .filter(Boolean)
    .join(" · ");
  const repeats = repeatLabel(event.recurrence);
  const image = event.cover_image_url ?? event.images[0]?.url ?? null;

  return (
    <div id={id} className="hidden bg-white text-fg">
      <div className="mx-auto flex h-[10in] w-[7.5in] flex-col gap-4">
        <OrgLine name={event.host_name} logoUrl={event.host_logo_url} />
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="h-[3in] w-full rounded-control object-cover"
          />
        )}
        <h1 style={{ fontSize: "36pt", lineHeight: 1.1 }} className="font-medium">
          {event.title}
        </h1>
        <div style={{ fontSize: "20pt" }} className="flex flex-col gap-1">
          <p>{when || "Date to be announced"}</p>
          {repeats && <p className="text-fg-muted">{repeats}</p>}
          <p>
            {event.location ||
              (event.is_virtual ? "Online" : "Location to be announced")}
          </p>
        </div>
        {event.description && (
          <p style={{ fontSize: "14pt" }} className="line-clamp-3">
            {event.description}
          </p>
        )}
        <div className="mt-auto flex items-center gap-6">
          <div
            aria-hidden="true"
            className="size-[2.4in] shrink-0 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div style={{ fontSize: "16pt" }} className="flex flex-col gap-2">
            <p className="font-medium">Scan to see this program and save your spot.</p>
            <p style={{ fontSize: "14pt" }} className="break-all text-fg-muted">
              {shortUrl(url)}
            </p>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Sessions in order, grouped under their Toronto calendar day. */
function byDay(events: Event[]): [string, Event[]][] {
  const days = new Map<string, Event[]>();
  for (const ev of events) {
    const key = ev.starts_at ? dayLabel(ev.starts_at) : "Date to be announced";
    days.set(key, [...(days.get(key) ?? []), ev]);
  }
  return [...days.entries()];
}

/**
 * This week's programs on one sheet: a line per dated session under its day,
 * and one QR code to the site's front door. `events` is already the seven-day
 * window the page chose; `orgName` is whose week it is.
 */
export function WeeklySheet({
  id,
  events,
  orgName,
  logoUrl,
  from,
  to,
}: {
  id: string;
  events: Event[];
  orgName: string;
  logoUrl?: string | null;
  from: Date;
  to: Date;
}) {
  const [home, setHome] = useState("");
  useEffect(() => setHome(window.location.origin), []);
  const svg = useQrSvg(home);
  const range = `${longDate(from.toISOString())} – ${longDate(to.toISOString())}`;

  return (
    <div id={id} className="hidden bg-white text-fg">
      <div className="mx-auto flex min-h-[10in] w-[7.5in] flex-col gap-3">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-1">
            <OrgLine name={orgName} logoUrl={logoUrl} />
            <h1 style={{ fontSize: "26pt", lineHeight: 1.1 }} className="font-medium">
              This week&apos;s programs
            </h1>
            <p style={{ fontSize: "16pt" }} className="text-fg-muted">
              {range}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center">
            <div
              aria-hidden="true"
              className="size-[1.4in] [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p style={{ fontSize: "14pt" }} className="text-center text-fg-muted">
              Scan for every program
            </p>
          </div>
        </div>
        {events.length === 0 ? (
          <p style={{ fontSize: "16pt" }}>Nothing scheduled this week.</p>
        ) : (
          <table
            style={{ fontSize: "14pt", lineHeight: 1.25 }}
            className="w-full border-collapse text-left"
          >
            <colgroup>
              <col className="w-[1.55in]" />
              <col className="w-[2.75in]" />
              <col />
            </colgroup>
            <tbody>
              {byDay(events).map(([day, rows]) => (
                <Fragment key={day}>
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={3}
                      className="border-b border-fg pb-0.5 pt-2 font-medium"
                    >
                      {day}
                    </th>
                  </tr>
                  {rows.map((ev) => (
                    <tr key={ev.id} className="border-b border-line align-top">
                      <td className="whitespace-nowrap py-1 pr-3">
                        {timeRange(ev.starts_at, ev.ends_at) || "TBA"}
                      </td>
                      <td className="py-1 pr-3 font-medium">{ev.title}</td>
                      <td className="py-1">
                        {ev.location || (ev.is_virtual ? "Online" : "TBA")}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
        <Footer />
      </div>
    </div>
  );
}
