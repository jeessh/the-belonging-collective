"use client";

import { ALL_ICONS, emojiFor } from "@/lib/icons";

// Two icons, picked one at a time. Ordered, so the sequence is part of the key
// — see ICON_POOL in core/icons.py for the trade this makes.
export const PICK_COUNT = 2;
// Mirrors PASSWORD_MIN_LENGTH in backend/app/core/security.py.
export const PASSWORD_MIN_LENGTH = 8;

export type AuthMethod = "icons" | "password";

export function OrderBadge({ n }: { n: number }) {
  // Centred on the corner point itself — half in, half out on both axes —
  // which is the only offset that reads as deliberate at any tile size.
  return (
    <span
      aria-hidden="true"
      className="absolute right-0 top-0 grid size-6 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full bg-primary-strong text-sm font-medium leading-none text-fg"
    >
      {n}
    </span>
  );
}

/**
 * The whole pool — two rows of six, nothing to scroll for — with the two
 * slots above it saying which pick they are on. One grid asked for two icons
 * with nothing saying so read as a single choice that had stopped responding.
 */
export function IconKeyPicker({
  picked,
  onToggle,
}: {
  picked: string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <p className="text-lg font-medium text-fg" aria-live="polite">
          {picked.length >= PICK_COUNT
            ? "Both chosen"
            : `Icon ${picked.length + 1} of ${PICK_COUNT}`}
        </p>
        <div className="flex items-center gap-3">
          {Array.from({ length: PICK_COUNT }).map((_, slot) => {
            const slug = picked[slot];
            return (
              <button
                key={slot}
                type="button"
                // Tapping a filled slot takes it back: one press to undo.
                onClick={() => slug && onToggle(slug)}
                disabled={!slug}
                aria-label={
                  slug
                    ? `Icon ${slot + 1}: ${slug}. Activate to remove it.`
                    : `Icon ${slot + 1}: not chosen yet`
                }
                className={`grid size-11 place-items-center rounded-control border-2 text-2xl leading-none disabled:cursor-default ${
                  slug
                    ? "border-primary-border bg-primary-soft"
                    : "border-dashed border-line text-fg-muted"
                }`}
              >
                {slug ? (
                  <span aria-hidden="true" className="glyph-centred">
                    {emojiFor(slug)}
                  </span>
                ) : (
                  <span aria-hidden="true" className="text-base">
                    {slot + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 pt-2 sm:grid-cols-6">
        {ALL_ICONS.map((slug, i) => {
          const order = picked.indexOf(slug);
          const isPicked = order !== -1;
          const full = picked.length >= PICK_COUNT && !isPicked;
          return (
            <button
              key={slug}
              type="button"
              data-focus-first={i === 0 ? "" : undefined}
              onClick={() => onToggle(slug)}
              aria-pressed={isPicked}
              aria-label={
                isPicked
                  ? `${slug}, chosen as icon ${order + 1}. Activate to remove.`
                  : `Choose ${slug} as icon ${picked.length + 1}`
              }
              className={`relative grid aspect-square place-items-center rounded-control border-2 text-3xl leading-none transition-colors ${
                isPicked
                  ? "border-primary-border bg-primary-soft"
                  : full
                    ? "border-line bg-surface opacity-40"
                    : "border-line bg-surface hover:border-primary-border hover:bg-surface-subtle"
              }`}
            >
              <span aria-hidden="true" className="glyph-centred">
                {emojiFor(slug)}
              </span>
              {isPicked && <OrderBadge n={order + 1} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A finished key, shown once so it can be remembered or handed over. */
export function IconKeyShown({
  icons,
  label = "Your login icons",
  note = "Remember them, in this order.",
}: {
  icons: string[];
  label?: string;
  note?: string;
}) {
  return (
    <div>
      <p className="text-lg font-medium text-fg">{label}</p>
      <ol className="mt-2 flex gap-4">
        {icons.map((slug, i) => (
          <li
            key={slug}
            className="relative grid size-20 place-items-center rounded-control border-2 border-primary-border bg-primary-soft text-4xl"
          >
            <span aria-hidden="true" className="glyph-centred">
              {emojiFor(slug)}
            </span>
            <span className="sr-only">
              Icon {i + 1}: {slug}
            </span>
            <OrderBadge n={i + 1} />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-base text-fg-muted">{note}</p>
    </div>
  );
}
