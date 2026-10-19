/**
 * Whether this browser has signed in to a member account before — the
 * duplicate-account nudge. Someone who has forgotten they have an account
 * tends to make a second one; when the sign-up flow starts on a device that
 * has been signed in from, it offers "Log in" and "Forgot your password?"
 * first.
 *
 * Only a masked hint is kept ("j•••@gmail.com"), never the address itself,
 * and only in this browser. Storage can be missing or refuse (private
 * windows, blocked site data); none of that is worth failing over.
 */

const KEY = "tbc.known_account";

function mask(email: string): string {
  const [name, domain] = email.trim().toLowerCase().split("@");
  if (!name || !domain) return "";
  return `${name.charAt(0)}•••@${domain}`;
}

/** After a sign-in or sign-up succeeds. */
export function rememberAccount(email: string): void {
  const hint = mask(email);
  if (!hint) return;
  try {
    window.localStorage.setItem(KEY, hint);
  } catch {
    /* nothing to remember with */
  }
}

/** The masked email this device last signed in with, or null. */
export function knownAccountHint(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
