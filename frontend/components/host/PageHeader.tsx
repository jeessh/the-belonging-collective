import type { MouseEvent, ReactNode } from "react";
import { BackButton } from "@/components/ui/BackButton";

/**
 * The back button on its own line above, then the page title — with an
 * optional line under it ("Posted by …") — and the page's own buttons: on the
 * title's row at the right edge, top-aligned with the title, or (`actionsBelow`,
 * the event pages) on their own line under the title.
 *
 * `title` is a string for an ordinary page (drawn as the h1) or a node that
 * brings its own heading — the event form's editable name.
 */
export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back to events",
  onBack,
  actions,
  actionsBelow = false,
  titleClassName = "",
}: {
  title: ReactNode;
  /** Muted text under the title, e.g. which organization the event is for. */
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  /** May preventDefault — the event form asks before dropping unsaved edits. */
  onBack?: (e: MouseEvent<HTMLElement>) => void;
  actions?: ReactNode;
  actionsBelow?: boolean;
  /** Extra classes for a string title's h1 (`event-title` on the event pages). */
  titleClassName?: string;
}) {
  const heading =
    typeof title === "string" ? (
      <h1 className={`text-3xl font-medium text-fg sm:text-4xl ${titleClassName}`}>{title}</h1>
    ) : (
      title
    );
  const buttons = actions && (
    <div
      className={
        actionsBelow
          ? "flex flex-wrap items-center gap-3"
          : "ml-auto flex flex-wrap items-center justify-end gap-3 lg:shrink-0 lg:flex-nowrap"
      }
    >
      {actions}
    </div>
  );
  return (
    <div className="no-print flex flex-col items-start gap-2">
      {backHref && <BackButton href={backHref} label={backLabel} onClick={onBack} />}
      <div
        className={`flex w-full flex-wrap items-start justify-between gap-4 ${
          actionsBelow ? "" : "lg:flex-nowrap"
        }`}
      >
        <div className="min-w-0 flex-1">
          {heading}
          {subtitle && <p className="mt-1 text-base text-fg-muted">{subtitle}</p>}
        </div>
        {!actionsBelow && buttons}
      </div>
      {actionsBelow && buttons && <div className="mt-2">{buttons}</div>}
    </div>
  );
}
