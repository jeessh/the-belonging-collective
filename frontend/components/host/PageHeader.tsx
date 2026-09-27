import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Back arrow, page title, and the page's own buttons on the right. */
export function PageHeader({
  title,
  backHref,
  backLabel = "Back to events",
  actions,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        {backHref && (
          <Link
            href={backHref}
            aria-label={backLabel}
            className="grid size-12 place-items-center rounded-control text-fg hover:bg-surface-subtle"
          >
            <ArrowLeft aria-hidden="true" className="size-12" />
          </Link>
        )}
        <h1 className="text-4xl font-medium text-fg sm:text-5xl">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
