"use client";

import { useRef, useState } from "react";
import { FileText, Pencil, Upload, X } from "lucide-react";
import { ApiError, apiMessage, uploadPoster } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/** Mirrors ALLOWED_POSTER_TYPES / MAX_POSTER_BYTES in routes/events.py. */
const ACCEPT = "application/pdf,image/png,image/jpeg";
const MAX_BYTES = 4 * 1024 * 1024;

export const isPdfUrl = (url: string) => /\.pdf(\?|$)/i.test(url);

/** The stored object's name — the only name left once it is uploaded. */
export function posterFileName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "poster");
  } catch {
    return "poster";
  }
}

/**
 * The agency's own flyer. Uploaded on pick and stored as `poster_url` on
 * save, like the cover image — but a PDF is allowed, so a preview is only
 * sometimes a picture.
 */
export function PosterField({
  value,
  onChange,
}: {
  /** The current URL, "" for none. */
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What they picked, for the label; a reload only has the stored name.
  const [pickedName, setPickedName] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("That poster is too large (max 4 MB).");
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadPoster(file));
      setPickedName(file.name);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 413
          ? "That poster is too large (max 4 MB)."
          : e instanceof ApiError && e.status === 415
            ? "Please choose a PDF, PNG, or JPEG."
            : apiMessage(e, "Upload failed. Please try again."),
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const pdf = value ? isPdfUrl(value) : false;

  return (
    <div className="flex flex-col items-start gap-3">
      {value ? (
        <div className="flex flex-wrap items-center gap-4">
          {pdf ? (
            <span className="inline-flex items-center gap-3 text-lg text-fg">
              <FileText aria-hidden="true" className="size-8 shrink-0 text-fg-icon" />
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="break-all underline underline-offset-4"
              >
                {pickedName ?? posterFileName(value)}
              </a>
            </span>
          ) : (
            <a href={value} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt={pickedName ?? "Poster"}
                className="max-h-40 rounded-control border border-line object-contain"
              />
            </a>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              trailingIcon={<Pencil />}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? "Uploading…" : "Replace"}
            </Button>
            <Button
              variant="ghost"
              leadingIcon={<X />}
              disabled={busy}
              onClick={() => {
                onChange("");
                setPickedName(null);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button
          leadingIcon={<Upload />}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "Upload poster"}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-label="Printable poster file"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {error && (
        <p role="alert" className="text-base text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
