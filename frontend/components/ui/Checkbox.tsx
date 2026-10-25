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
  dense = false,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  /** The console's size: 14px text, 36px row. */
  dense?: boolean;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <label
      htmlFor={inputId}
      className={`inline-flex cursor-pointer items-center text-fg ${
        dense ? "min-h-9 gap-2.5 text-sm" : "min-h-11 gap-3 text-lg"
      } ${className}`}
    >
      <span className="relative grid shrink-0 place-items-center">
        <input
          id={inputId}
          type="checkbox"
          className={`peer appearance-none rounded border-2 border-primary-strong bg-surface transition-colors checked:bg-primary-strong ${
            dense ? "size-4" : "size-5"
          }`}
          {...rest}
        />
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className={`pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100 ${
            dense ? "size-3" : "size-3.5"
          }`}
        />
      </span>
      {label}
    </label>
  );
}
