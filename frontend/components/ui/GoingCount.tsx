import { Users } from "lucide-react";

/**
 * "N going" — how many people saved it, shown to everyone. Nothing at zero:
 * an empty room is not a selling point. (It used to say "See who else is
 * going" to signed-out visitors, as a way to sign in; the count is public
 * now. `onSignIn` / `signInHref` are kept so callers needn't change.)
 */
export function GoingCount({
  count,
  onSignIn,
  signInHref,
  variant = "line",
  iconClassName = "size-6",
  className = "",
}: {
  count: number | null | undefined;
  onSignIn?: () => void;
  /** Where to sign in when there is no overlay to open. */
  signInHref?: string;
  /** `line` (default): icon + "N going". `tag`: the sheet's small grey "26 GOING" chip. */
  variant?: "line" | "tag";
  /** The people icon's size, to match the other fact icons beside it. */
  iconClassName?: string;
  className?: string;
}) {
  // Nothing at zero, and nothing where a count wasn't sent.
  if (!count) return null;
  if (variant === "tag") {
    return (
      <span
        className={`inline-flex items-center rounded-control bg-surface-subtle px-3 py-1 text-sm uppercase tracking-wide text-fg-muted ${className}`}
      >
        {count} going
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-3 text-fg ${className}`}>
      <Users aria-hidden="true" className={`shrink-0 text-fg-muted ${iconClassName}`} />
      {count} going
    </span>
  );
}
