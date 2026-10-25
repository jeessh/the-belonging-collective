import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
  onBack?: (e: MouseEvent<HTMLAnchorElement>) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {backHref && (
          <Link
            href={backHref}
            aria-label={backLabel}
            onClick={onBack}
            className="grid size-11 place-items-center rounded-control text-fg hover:bg-surface-subtle"
          >
            <ArrowLeft aria-hidden="true" className="size-9" />
          </Link>
        )}
        <h1 className="text-3xl font-medium text-fg sm:text-4xl">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
