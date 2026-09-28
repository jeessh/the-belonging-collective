import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { TextField } from "@/components/ui/TextField";

/**
 * Console primitives the pages share. The table parts are plain wrappers
 * over real table elements — the semantics (caption, scope, th) are what
 * make these usable with a screen reader, so nothing here replaces them
 * with divs. Drawn as the design's account list: a plain header line,
 * hairlines between rows.
 *
 * The field parts give a `<select>` and a `<textarea>` the same box as
 * `ui/TextField` ("Header" over a squared box with grey subtext), so a page
 * mixing the three reads as one form.
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
    // Scrolls sideways on a narrow screen rather than breaking the page.
    // `relative` so the cells' sr-only spans (absolutely positioned) are
    // contained and clipped with the table instead of widening the page.
    <div className="relative overflow-x-auto">
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

/* ---------------- fields ---------------- */

/** The box `ui/TextField` draws, for the controls it doesn't wrap. */
export const controlClass =
  "min-h-12 w-full rounded border border-line bg-surface px-4 py-3 text-lg text-fg placeholder:text-fg-muted focus:outline focus:outline-[3px] focus:outline-offset-2 focus:outline-[#5b5bd6]";

/** The design's red asterisk, with "(required)" for a screen reader. */
export function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="ml-1 text-danger-fg">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}

/** `TextField`'s "Header" label over any control. */
export function Field({
  label,
  required,
  aside,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  /** Sits at the right of the label line — a character counter. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="flex items-end justify-between gap-3 text-lg font-medium text-fg">
        <span>
          {label}
          {required && <RequiredMark />}
        </span>
        {aside}
      </span>
      {children}
    </label>
  );
}

export function Select({
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${controlClass} ${className}`} {...rest} />;
}

export function TextArea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClass} resize-y ${className}`} {...rest} />;
}

/** The design's search box: a magnifier in a grey field, the label read out only. */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <TextField
      type="search"
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      icon={<Search />}
      className={`[&>div]:min-h-14 [&>div]:rounded-control [&>div]:bg-surface-subtle [&>label]:sr-only ${className}`}
    />
  );
}
