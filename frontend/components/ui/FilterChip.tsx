import type { ReactNode } from "react";

/**
 * The component sheet's "FILTER" chip: outlined cyan when off, solid cyan when
 * on. A toggle, so it carries `aria-pressed`.
 */
export function FilterChip({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-control border px-4 py-1.5 text-base uppercase tracking-wide transition-colors sm:text-xl ${
        selected
          ? "border-transparent bg-primary-active text-fg"
          : "border-primary-strong bg-surface text-fg-muted hover:bg-primary-soft"
      } ${className}`}
    >
      {children}
    </button>
  );
}
