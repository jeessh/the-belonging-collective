import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /**
   * The grey text inside the empty field. Required: the design gives every
   * field one ("Header" over "Subtext"), including ones no frame draws.
   */
  placeholder: string;
  /** Shown under the field and read out with it; also marks it invalid. */
  error?: string | null;
  /** A leading icon inside the box, as the design's date, time and place fields. */
  icon?: ReactNode;
  /**
   * `header` (default): the label above a squared box. `floating`: the
   * component sheet's rounded box with a small upper-case label inside it.
   */
  variant?: "header" | "floating";
};

/**
 * The design's text field. `required` both marks the label with an asterisk
 * and reaches the input, so the browser's own validation still runs.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    {
      label,
      error,
      required,
      id,
      icon,
      variant = "header",
      className = "",
      ...rest
    },
    ref,
  ) {
    const generated = useId();
    const inputId = id ?? generated;
    const errorId = `${inputId}-error`;
    const border = error ? "border-danger-border" : "border-line";
    const mark = required && (
      <span aria-hidden="true" className="ml-1 text-danger-fg">
        *
      </span>
    );
    const input = (
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={
          variant === "floating"
            ? "w-full bg-transparent text-lg text-fg outline-none placeholder:text-fg-muted"
            : "min-w-0 flex-1 bg-transparent text-lg text-fg outline-none placeholder:text-fg-muted"
        }
        {...rest}
      />
    );

    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {variant === "floating" ? (
          <label
            htmlFor={inputId}
            className={`flex flex-col gap-1 rounded-field border bg-surface px-5 py-3 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[#5b5bd6] ${border}`}
          >
            <span className="text-sm uppercase tracking-wide text-fg-muted">
              {label}
              {mark}
            </span>
            {input}
          </label>
        ) : (
          <>
            <label htmlFor={inputId} className="text-lg font-medium text-fg">
              {label}
              {mark}
            </label>
            <div
              className={`flex min-h-12 items-center gap-3 rounded border bg-surface px-4 focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[#5b5bd6] ${border}`}
            >
              {icon && (
                <span
                  aria-hidden="true"
                  className="shrink-0 text-fg-icon [&>svg]:size-6"
                >
                  {icon}
                </span>
              )}
              {input}
            </div>
          </>
        )}
        {error && (
          <p id={errorId} className="text-base text-danger-fg">
            {error}
          </p>
        )}
      </div>
    );
  },
);
