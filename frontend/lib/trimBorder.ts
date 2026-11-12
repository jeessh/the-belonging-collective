"use client";

import { useEffect, useState } from "react";

/**
 * Event pictures copied from a shop or a flyer sometimes carry a frame of
 * their own: a solid green border, a white mat. In a card that frame shows
 * as a "border" we never drew. This finds a solid-colour band along the
 * picture's edges when it loads and hands back the picture without it, so
 * the photo fills its box the way every other one does.
 *
 * Display-only: the stored file is untouched, the server's own copies (share
 * emails) are untouched, and anything that can't be read — a host without
 * CORS, a decode error — simply shows as it is.
 */

/** How far into the picture a frame may reach, per side. */
const MAX_TRIM = 0.18;
/** Thinner than this (per side, as a share of the side) isn't worth a crop. */
const MIN_TRIM = 0.012;
/** A pixel this close to the frame colour (0–255 per channel) is frame. */
const TOLERANCE = 38;
/** A row or column is frame when this share of its pixels are. */
const ROW_SHARE = 0.92;
/** The analysis copy's longest side, px. */
const SAMPLE = 240;
/** The cropped copy's longest side, px — sharp in any card. */
const OUTPUT = 1400;

const cache = new Map<string, Promise<string | null>>();

/** Our own stock photos have no frame; nothing to look at. */
function worthChecking(src: string): boolean {
  return !!src && !src.startsWith("/placeholders/") && !src.startsWith("data:") && !src.startsWith("blob:");
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Readable pixels need CORS; a host that doesn't send it fails here and
    // the picture is shown untouched.
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

type Box = { top: number; right: number; bottom: number; left: number };

/** The frame's thickness on each side, in sample pixels (0 where none). */
function findFrame(data: Uint8ClampedArray, w: number, h: number): Box | null {
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  // The frame colour is what the four corners agree on.
  const corners = [at(1, 1), at(w - 2, 1), at(1, h - 2), at(w - 2, h - 2)];
  const close = (a: number[], b: number[]) =>
    Math.abs(a[0] - b[0]) <= TOLERANCE &&
    Math.abs(a[1] - b[1]) <= TOLERANCE &&
    Math.abs(a[2] - b[2]) <= TOLERANCE;
  if (corners.some((c) => c[3] < 200)) return null; // transparent edges: leave it
  const frame = corners[0];
  if (!corners.every((c) => close(c, frame))) return null;

  const rowIsFrame = (y: number) => {
    let n = 0;
    for (let x = 0; x < w; x++) if (close(at(x, y), frame)) n++;
    return n / w >= ROW_SHARE;
  };
  const colIsFrame = (x: number) => {
    let n = 0;
    for (let y = 0; y < h; y++) if (close(at(x, y), frame)) n++;
    return n / h >= ROW_SHARE;
  };
  const maxY = Math.floor(h * MAX_TRIM);
  const maxX = Math.floor(w * MAX_TRIM);
  let top = 0;
  while (top < maxY && rowIsFrame(top)) top++;
  let bottom = 0;
  while (bottom < maxY && rowIsFrame(h - 1 - bottom)) bottom++;
  let left = 0;
  while (left < maxX && colIsFrame(left)) left++;
  let right = 0;
  while (right < maxX && colIsFrame(w - 1 - right)) right++;
  // A frame runs round the picture; one band alone is the photo's own
  // white wall or sky, which we leave.
  const sides = [top / h, bottom / h, left / w, right / w].filter((s) => s >= MIN_TRIM).length;
  if (sides < 3) return null;
  // Take a pixel more, so no antialiased edge of the frame is left behind.
  return { top: top + 1, right: right + 1, bottom: bottom + 1, left: left + 1 };
}

async function trim(src: string): Promise<string | null> {
  const img = await load(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (!W || !H) return null;
  const k = Math.min(1, SAMPLE / Math.max(W, H));
  const sw = Math.max(8, Math.round(W * k));
  const sh = Math.max(8, Math.round(H * k));
  const sample = document.createElement("canvas");
  sample.width = sw;
  sample.height = sh;
  const sctx = sample.getContext("2d", { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(img, 0, 0, sw, sh);
  const box = findFrame(sctx.getImageData(0, 0, sw, sh).data, sw, sh); // throws if tainted
  if (!box) return null;

  // Back to the full picture's pixels.
  const x = Math.round(box.left / k);
  const y = Math.round(box.top / k);
  const cw = W - x - Math.round(box.right / k);
  const ch = H - y - Math.round(box.bottom / k);
  if (cw < W * 0.5 || ch < H * 0.5) return null;
  const s = Math.min(1, OUTPUT / Math.max(cw, ch));
  const out = document.createElement("canvas");
  out.width = Math.round(cw * s);
  out.height = Math.round(ch * s);
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.drawImage(img, x, y, cw, ch, 0, 0, out.width, out.height);
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/jpeg", 0.9));
  return blob ? URL.createObjectURL(blob) : null;
}

/** The picture without its frame, once worked out (once per address). */
export function trimmedSrc(src: string): Promise<string | null> {
  if (!worthChecking(src) || typeof document === "undefined") return Promise.resolve(null);
  let job = cache.get(src);
  if (!job) {
    job = trim(src).catch(() => null);
    cache.set(src, job);
  }
  return job;
}

/**
 * `src`, or the same picture with its frame cut off when it has one. The
 * plain picture shows first; the cropped one replaces it when ready (the
 * same address returns at once after the first time).
 */
export function useTrimmedSrc(src: string): string {
  const [out, setOut] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    let live = true;
    void trimmedSrc(src).then((t) => {
      if (live && t) setOut({ from: src, to: t });
    });
    return () => {
      live = false;
    };
  }, [src]);
  return out && out.from === src ? out.to : src;
}
