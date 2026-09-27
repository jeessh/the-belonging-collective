import type { ReactNode } from "react";

/**
 * Table primitives for the account pages. Plain wrappers over real table
 * elements — the semantics (caption, scope, th) are what make these usable
 * with a screen reader, so nothing here replaces them with divs. Drawn as the
 * design's account list: a plain header line, hairlines between rows.
 */

export function TableCard({
  caption,
  head,
  children,
}: {
  caption: string;
  head: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xl text-fg">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="whitespace-nowrap px-3 pb-3 font-normal text-fg"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-active border-t border-line-active">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-subtle text-fg",
    good: "bg-tag-free-bg text-tag-free-fg",
    warn: "bg-tag-dropin-bg text-tag-dropin-fg",
  };
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-control px-3 py-1 text-base ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-fg-muted">
        {text}
      </td>
    </tr>
  );
}
