import { forwardRef, useId, type InputHTMLAttributes } from "react";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Shown under the field and read out with it; also marks it invalid. */
  error?: string | null;
};

/**
 * Label above, boxed input, error below — the design's "Text Field".
 * `required` both marks the label with an asterisk and reaches the input,
 * so the browser's own validation still runs.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { label, error, required, id, className = "", ...rest },
    ref,
  ) {
    const generated = useId();
    const inputId = id ?? generated;
    const errorId = `${inputId}-error`;
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <label htmlFor={inputId} className="text-lg font-medium text-fg">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-1 text-danger-fg">
              *
            </span>
          )}
        </label>
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`min-h-12 rounded-field border bg-surface px-4 py-3 text-lg text-fg placeholder:text-fg-muted ${
            error ? "border-danger-border" : "border-line"
          }`}
          {...rest}
        />
        {error && (
          <p id={errorId} className="text-base text-danger-fg">
            {error}
          </p>
        )}
      </div>
    );
  },
);
