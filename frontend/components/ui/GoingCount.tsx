import { Bookmark } from "lucide-react";

/**
 * "N people saved this event" — how many people have it saved, shown to
 * everyone (the console says it the same way). Nothing at zero:
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
  capacity,
}: {
  count: number | null | undefined;
  /** The organizer's attendee limit: the line reads "5/20 spots left"
      in place of the saved count. */
  capacity?: number | null;
  onSignIn?: () => void;
  /** Where to sign in when there is no overlay to open. */
  signInHref?: string;
  /** `line` (default): icon + "N going". `tag`: the small grey "26 SAVED" chip. */
  variant?: "line" | "tag";
  /** The people icon's size, to match the other fact icons beside it. */
  iconClassName?: string;
  className?: string;
}) {
  // Shown at zero too ("0 people saved this event"), as the console does;
  // nothing only where a count wasn't sent (a special-access program the
  // viewer isn't approved for).
  if (count == null) return null;
  if (variant === "tag") {
    return (
      <span
        className={`inline-flex items-center rounded-control bg-surface-subtle px-3 py-1 text-sm uppercase tracking-wide text-fg-muted ${className}`}
      >
        {count} saved
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-3 text-fg-muted ${className}`}>
      <Bookmark aria-hidden="true" className={`shrink-0 text-fg-muted ${iconClassName}`} />
      {/* With an attendee limit, the line is the places left instead. */}
      {/* The number in the text colour, like the location; the words grey. */}
      {capacity != null ? (
        <span>
          <span className="text-fg">
            {Math.max(capacity - count, 0)}/{capacity}
          </span>{" "}
          spots left
        </span>
      ) : (
        <span>
          <span className="text-fg">{count}</span>{" "}
          {count === 1 ? "person" : "people"} saved this event
        </span>
      )}
    </span>
  );
}
