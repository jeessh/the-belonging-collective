"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, FileText, Printer } from "lucide-react";
import type { Event } from "@/lib/api";
import { longDate, timeRange } from "@/lib/time";
import { Button } from "@/components/ui/Button";
import { eventUrl } from "@/components/CopyLinkButton";
import { isPdfUrl, posterFileName } from "@/components/host/PosterField";

/**
 * The poster, and a QR code for the wall next to it.
 *
 * The code opens the program's public page — not the poster file — so a scan
 * lands on something that can be saved, shared and, for a special-access
 * program, asked into. The page shows the poster too. Drawn as SVG in the
 * browser; PNG is rendered on demand for the download.
 */
export function PosterSection({ event }: { event: Event }) {
  const [url, setUrl] = useState("");
  const [svg, setSvg] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = eventUrl(event.id);
    setUrl(target);
    QRCode.toString(target, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [event.id]);

  const slug = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

  function save(href: string, ext: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = `qr-${slug || "program"}.${ext}`;
    a.click();
  }

  function downloadSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    save(href, "svg");
    URL.revokeObjectURL(href);
  }

  async function downloadPng() {
    save(await QRCode.toDataURL(url, { width: 1024, margin: 2 }), "png");
  }

  function printSheet() {
    // The same trick as the page's own Print: mark the sheet as the print
    // target, print, put it back. The global print rules hide the rest.
    const el = sheetRef.current;
    if (!el) return;
    el.classList.remove("hidden");
    el.classList.add("print-target");
    window.print();
    el.classList.add("hidden");
    el.classList.remove("print-target");
  }

  const poster = event.poster_url!;
  const pdf = isPdfUrl(poster);
  const when = [longDate(event.starts_at), timeRange(event.starts_at, event.ends_at)]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      aria-labelledby="poster-heading"
      className="flex flex-col gap-6 border-t border-line pt-8"
    >
      <h2 id="poster-heading" className="text-2xl font-medium text-fg">
        Poster
      </h2>
      <div className="grid gap-8 lg:grid-cols-[598px_minmax(0,1fr)]">
        <div className="flex flex-col items-start gap-3">
          {pdf ? (
            <a
              href={poster}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 rounded-control border border-line px-4 py-3 text-lg text-fg underline underline-offset-4 hover:bg-surface-subtle"
            >
              <FileText aria-hidden="true" className="size-8 shrink-0 text-fg-icon" />
              Open the poster (PDF)
              <span className="sr-only"> — {posterFileName(poster)}</span>
            </a>
          ) : (
            <a href={poster} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={poster}
                alt={`Poster for ${event.title}`}
                className="max-h-[420px] rounded-control border border-line object-contain"
              />
            </a>
          )}
        </div>

        <div className="flex flex-col items-start gap-4">
          {svg ? (
            <div
              role="img"
              aria-label={`QR code that opens ${event.title}`}
              className="w-full max-w-[220px] rounded-control border border-line bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <p className="text-lg text-fg-muted">Making the QR code…</p>
          )}
          <p className="text-base text-fg-muted">
            Scanning opens the program&apos;s page:{" "}
            <span className="break-all">{url}</span>
          </p>
          {event.access_group && (
            <p className="text-base text-fg">
              People without access can request it from this page.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              leadingIcon={<Download />}
              disabled={!svg}
              onClick={() => void downloadPng()}
            >
              Download QR (PNG)
            </Button>
            <Button leadingIcon={<Download />} disabled={!svg} onClick={downloadSvg}>
              Download QR (SVG)
            </Button>
            <Button leadingIcon={<Printer />} disabled={!svg} onClick={printSheet}>
              Print QR
            </Button>
          </div>
        </div>
      </div>

      {/* The print sheet: one page with the code, and enough words that a
          passer-by knows what they are scanning. Hidden until Print QR. */}
      <div ref={sheetRef} className="hidden bg-white text-fg">
        <div className="mx-auto flex max-w-[640px] flex-col items-center gap-6 py-8 text-center">
          <div
            aria-hidden="true"
            className="w-[360px] max-w-full [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <h1 className="text-4xl font-medium leading-tight">{event.title}</h1>
          {when && <p className="text-2xl">{when}</p>}
          <p className="text-2xl">{event.host_name}</p>
          <p className="text-lg">
            Scan to open this program
            {event.access_group ? " or to request access" : ""}.
          </p>
          <p className="break-all text-base text-fg-muted">{url}</p>
        </div>
      </div>
    </section>
  );
}
