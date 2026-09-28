import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border-2 border-primary-border bg-primary hover:bg-primary-active disabled:border-transparent disabled:bg-surface-subtle disabled:text-fg-muted",
  secondary:
    "border border-line bg-surface hover:bg-surface-subtle disabled:border-transparent disabled:bg-surface-subtle disabled:text-fg-muted",
  ghost:
    "border border-transparent bg-transparent hover:bg-surface-subtle disabled:text-fg-muted",
  // The design's "Un-publish" / "Yes, delete": pink fill, red edge.
  danger:
    "border border-danger-border bg-danger hover:bg-danger-hover disabled:border-transparent disabled:bg-surface-subtle disabled:text-fg-muted",
};

// Both clear 44px; `lg` is the design's 20px-text control for member CTAs,
// `md` the same shape sized for the console's denser rows.
const SIZE: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 py-2 text-base",
  lg: "min-h-14 px-6 py-3 text-xl",
};

/** The classes alone, for a Link that should look like a button. */
export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className = "",
): string {
  return `inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-control font-medium text-fg transition-colors disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`;
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      leadingIcon,
      trailingIcon,
      type = "button",
      className = "",
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonClass(variant, size, className)}
        {...rest}
      >
        {leadingIcon && (
          <span aria-hidden="true" className="shrink-0 [&>svg]:size-6">
            {leadingIcon}
          </span>
        )}
        {children}
        {trailingIcon && (
          <span aria-hidden="true" className="shrink-0 [&>svg]:size-6">
            {trailingIcon}
          </span>
        )}
      </button>
    );
  },
);
