/**
 * Whether a typed address is worth sending: something@domain.tld, no spaces.
 * The API's own validation is stricter and still has the last word; this
 * only lets a form say "that isn't an email" on the field, at the step
 * where it was typed, instead of after the password step.
 */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const INVALID_EMAIL = "Enter a valid email address, like name@example.com.";
