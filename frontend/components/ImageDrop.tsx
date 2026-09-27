"use client";

import { useRef, useState } from "react";
import { ArrowUpFromLine, Pencil, X } from "lucide-react";
import { ApiError, uploadImage } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_LABEL,
  IMAGE_SIZING,
  ImageRejected,
  prepareImage,
  type SizingKey,
} from "@/lib/prepareImage";

/**
 * The design's image drop zone: drag a file onto it or pick one, and it
 * uploads straight away and hands back the URL. With an image already chosen
 * it shows the picture with "Change image" under it, as the edit form draws.
 */
export function ImageDrop({
  label,
  value,
  onChange,
  sizing = "cover",
}: {
  label: string;
  /** The current URL, "" for none. */
  value: string;
  onChange: (url: string) => void;
  /** What the image is for — decides the size asked for. Covers by default. */
  sizing?: SizingKey;
}) {
  const { minEdge, idealEdge } = IMAGE_SIZING[sizing];
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // Checked and resized before it goes anywhere: a 12MP photo used to
      // upload slowly and then fail the server's 5MB cap, and a 200px logo
      // uploaded fine and looked like a smear on every card.
      onChange(await uploadImage(await prepareImage(file, sizing)));
    } catch (e) {
      setError(
        e instanceof ImageRejected
          ? e.message
          : e instanceof ApiError
            ? e.status === 413
              ? "That image is too large (max 5 MB)."
              : "Upload failed. Please try again."
            : e instanceof Error
              ? e.message
              : "Upload failed.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const logo = sizing === "logo";

  return (
    <div>
      {value ? (
        <div className="flex flex-col items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className={`rounded-control object-cover ${
              logo ? "size-40" : "aspect-[598/278] w-full"
            }`}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              trailingIcon={<Pencil />}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? "Uploading…" : "Change image"}
            </Button>
            <Button
              variant="ghost"
              leadingIcon={<X />}
              disabled={busy}
              onClick={() => onChange("")}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-3 rounded-control border border-dashed px-6 py-9 text-center transition-colors ${
            dragOver
              ? "border-primary-border bg-primary-soft"
              : "border-fg-icon-muted bg-surface-subtle"
          } ${logo ? "" : "min-h-[278px]"}`}
        >
          <ArrowUpFromLine aria-hidden="true" className="size-12 text-fg" />
          <p className="text-xl text-fg">Drag an image here</p>
          <p className="text-base text-fg">
            Supported file types: {ACCEPTED_LABEL} · {idealEdge}×{idealEdge}{" "}
            works best, at least {minEdge}×{minEdge}
          </p>
          <div className="flex w-full max-w-sm items-center gap-6 text-xl text-fg">
            <span aria-hidden="true" className="h-px flex-1 bg-fg-icon-muted" />
            Or
            <span aria-hidden="true" className="h-px flex-1 bg-fg-icon-muted" />
          </div>
          <Button
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            aria-label={`${label}: upload from computer`}
          >
            {busy ? "Uploading…" : "Upload from computer"}
          </Button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && (
        <p role="alert" className="mt-2 text-base text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
