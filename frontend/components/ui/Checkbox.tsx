import { useId, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";

/**
 * The component sheet's checkbox: a cyan-edged square, filled cyan with a
 * white tick when checked. A real checkbox underneath, so keyboard, forms and
 * screen readers work as usual.
 */
export function Checkbox({
  label,
  className = "",
  id,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <label
      htmlFor={inputId}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-3 text-lg text-fg ${className}`}
    >
      <span className="relative grid shrink-0 place-items-center">
        <input
          id={inputId}
          type="checkbox"
          className="peer size-5 appearance-none rounded border-2 border-primary-strong bg-surface transition-colors checked:bg-primary-strong"
          {...rest}
        />
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="pointer-events-none absolute size-3.5 text-white opacity-0 peer-checked:opacity-100"
        />
      </span>
      {label}
    </label>
  );
}
