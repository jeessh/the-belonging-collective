import { Button } from "@/components/ui/Button";

/**
 * The sheet's bottom row: an outlined button on the left, a cyan one on the
 * right, each half the width (Login | Create account, Cancel | Login). The
 * primary submits the form it sits in unless it has an `onClick` of its own;
 * without a secondary it takes the whole row.
 */
export function FormFooter({
  secondary,
  primary,
  className = "",
}: {
  secondary?: { label: string; onClick: () => void; disabled?: boolean };
  primary: { label: string; onClick?: () => void; disabled?: boolean };
  className?: string;
}) {
  // "Back" beside "Create account" is wider than a phone sheet at the
  // design's 20px; a step down in type and padding keeps the pair on one
  // row and the buttons at their full height.
  const half = "flex-1 max-sm:px-4 max-sm:text-lg";
  return (
    <div className={`flex gap-4 ${className}`}>
      {secondary && (
        <Button
          variant="secondary"
          size="lg"
          className={half}
          disabled={secondary.disabled}
          onClick={secondary.onClick}
        >
          {secondary.label}
        </Button>
      )}
      <Button
        type={primary.onClick ? "button" : "submit"}
        variant="primary"
        size="lg"
        className={half}
        disabled={primary.disabled}
        onClick={primary.onClick}
      >
        {primary.label}
      </Button>
    </div>
  );
}
