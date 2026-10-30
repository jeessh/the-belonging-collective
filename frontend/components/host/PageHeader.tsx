import type { MouseEvent, ReactNode } from "react";
import { BackButton } from "@/components/ui/BackButton";

/** Back arrow, page title, and the page's own buttons on the right. */
export function PageHeader({
  title,
  backHref,
  backLabel = "Back to events",
  onBack,
  actions,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  /** May preventDefault — the event form asks before dropping unsaved edits. */
  onBack?: (e: MouseEvent<HTMLElement>) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {backHref && <BackButton href={backHref} label={backLabel} onClick={onBack} />}
        <h1 className="text-3xl font-medium text-fg sm:text-4xl">{title}</h1>
      </div>
      {/* Pushed to the right edge, and kept there when the row wraps under
          the title — wrapped buttons used to start at the left. */}
      {actions && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">{actions}</div>
      )}
    </div>
  );
}
