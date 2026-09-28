"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { CircleCheck, KeyRound, Smile } from "lucide-react";
import { ApiError, api, apiMessage } from "@/lib/api";
import { ALL_ICONS, emojiFor } from "@/lib/icons";
import { Button } from "@/components/ui/Button";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";

// Two icons, picked one at a time. Ordered, so the sequence is part of the key
// — see ICON_POOL in core/icons.py for the trade this makes.
const PICK_COUNT = 2;
// Mirrors PASSWORD_MIN_LENGTH in backend/app/core/security.py.
const PASSWORD_MIN_LENGTH = 8;

const GENERIC_ERROR = "Something went wrong. Please try again.";
// Which credential the member last chose, per browser.
const METHOD_KEY = "tbc.member-auth-method";

export type AuthMethod = "icons" | "password";
export type AuthDoor = "signup" | "login";
export type AuthEntry = "chooser" | AuthDoor;

type Step =
  | "chooser"
  | "name"
  | "icons"
  | "email"
  | "password"
  | "credentials"
  | "complete";

/** What the surface around the flow draws: a heading, an optional line under it, and the step itself. */
export type AuthView = {
  title: string;
  subtitle?: string;
  /** Sits above the title on the success screen. */
  icon?: ReactNode;
  body: ReactNode;
};

function firstStep(door: AuthDoor, method: AuthMethod): Step {
  return door === "login" && method === "password" ? "credentials" : "name";
}

/**
 * Member sign-up and log-in, one step at a time.
 *
 * Owns the whole state machine — chooser, either door, either credential,
 * the conflict handling on the icon key, and the success screen — and hands
 * each step back as a title plus a body. The in-feed overlay wraps that in a
 * Modal; `/signup` wraps it in a page. Both toast on their own.
 *
 * `onSignedIn` fires once the cookie is set: straight away for a log-in, and
 * from "Continue to events" after an account is created, so a new member
 * sees their icons before the modal goes.
 */
export function MemberAuthFlow({
  initial = "chooser",
  onSignedIn,
  onGuest,
  children,
}: {
  initial?: AuthEntry;
  onSignedIn: (result: { mode: "login" | "signup" }) => void;
  /** "Continue as guest". Browsing is already open; this just closes the door. */
  onGuest: () => void;
  children: (view: AuthView) => ReactNode;
}) {
  const toast = useToast();
  const [door, setDoor] = useState<AuthDoor>(
    initial === "login" ? "login" : "signup",
  );
  const [method, setMethod] = useState<AuthMethod>("icons");
  const [step, setStep] = useState<Step>(
    initial === "chooser" ? "chooser" : "name",
  );
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The address already has an account, so "log in instead" is the fix.
  const [emailTaken, setEmailTaken] = useState(false);
  // The name exists but this key does not open it. Distinct from any other
  // error because it is the only one a member cannot resolve by retrying —
  // and "I forgot my icons" is the door for the one who genuinely can't.
  const [conflict, setConflict] = useState(false);
  const [forgot, setForgot] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  function clearFeedback() {
    setError(null);
    setEmailTaken(false);
    setConflict(false);
    setForgot(false);
  }

  function chooseMethod(next: AuthMethod) {
    setMethod(next);
    try {
      localStorage.setItem(METHOD_KEY, next);
    } catch {
      /* private mode, or storage blocked — the default still works */
    }
    clearFeedback();
    setPicked([]);
    setStep((s) =>
      s === "chooser" || s === "complete" ? s : firstStep(door, next),
    );
  }

  // Read after mount so the server render and the first client render agree.
  useEffect(() => {
    try {
      if (localStorage.getItem(METHOD_KEY) === "password")
        chooseMethod("password");
    } catch {
      /* see above */
    }
  }, []);

  // Each step lands focus on its first field, else its first button — the
  // icon grid marks its own first tile, since the switch above it comes
  // first in the DOM.
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const target =
      root.querySelector<HTMLElement>("input, [data-focus-first]") ??
      root.querySelector<HTMLElement>("button:not([disabled])");
    target?.focus();
  }, [step, forgot]);

  function enter(next: AuthDoor) {
    setDoor(next);
    clearFeedback();
    setPicked([]);
    setStep(firstStep(next, method));
  }

  function togglePick(slug: string) {
    clearFeedback();
    setPicked((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= PICK_COUNT) return prev;
      return [...prev, slug];
    });
  }

  function finish(mode: "login" | "signup") {
    if (mode === "login") {
      toast.show({ title: "Successfully logged in!" });
      onSignedIn({ mode });
      return;
    }
    setStep("complete");
  }

  async function submitIcons(createNew = false) {
    setBusy(true);
    clearFeedback();
    try {
      const res = await api<{ mode: "login" | "signup" | "conflict" }>(
        "/auth/user",
        {
          method: "POST",
          body: JSON.stringify({
            first_name: first,
            last_name: last,
            icons: picked,
            // Only after the member has been told the name is taken and said
            // they are someone else. Otherwise a mistap would quietly become
            // a second account, stranding the one they own.
            create_new: createNew,
          }),
        },
      );
      if (res.mode === "conflict") {
        setConflict(true);
        return;
      }
      finish(res.mode);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? `Choose ${PICK_COUNT} icons.`
          : apiMessage(e, GENERIC_ERROR),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    clearFeedback();
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/signup/user", {
        method: "POST",
        body: JSON.stringify({
          first_name: first,
          last_name: last,
          email,
          password,
        }),
      });
      finish("signup");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setEmailTaken(true);
      setError(
        err instanceof ApiError && err.status === 422
          ? "Enter a valid email address."
          : apiMessage(err, GENERIC_ERROR),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearFeedback();
    try {
      await api("/auth/login/user", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      finish("login");
    } catch (err) {
      setError(apiMessage(err, "Wrong email or password."));
    } finally {
      setBusy(false);
    }
  }

  function guest() {
    toast.show({
      title: "Viewing as a guest",
      description: "Log in to save events.",
      tone: "info",
    });
    onGuest();
  }

  const nameReady = first.trim() !== "" && last.trim() !== "";

  const switcher = (
    <div className="flex items-center gap-4">
      <SegmentedToggle
        label="Sign-in method"
        shape="pill"
        value={method}
        onChange={chooseMethod}
        segments={[
          { value: "icons", label: "Icons", icon: <Smile />, iconOnly: true },
          {
            value: "password",
            label: "Password",
            icon: <KeyRound />,
            iconOnly: true,
          },
        ]}
      />
      <span aria-hidden="true" className="text-lg text-fg-muted">
        {method === "icons" ? "Icons" : "Password"}
      </span>
    </div>
  );

  const errorLine = error && (
    <div role="alert" className="flex flex-col items-start gap-2">
      <p className="text-lg font-medium text-danger-fg">{error}</p>
      {emailTaken && (
        <Button variant="ghost" onClick={() => enter("login")}>
          Login instead
        </Button>
      )}
    </div>
  );

  let view: AuthView;

  switch (step) {
    case "chooser":
      view = {
        title: "You're not logged in",
        subtitle: "Create an account to save events.",
        body: (
          <div className="flex flex-col gap-4">
            <Button variant="primary" size="lg" onClick={() => enter("signup")}>
              Create an account
            </Button>
            <Button variant="secondary" size="lg" onClick={() => enter("login")}>
              Login
            </Button>
            <div aria-hidden="true" className="flex items-center gap-6 py-1">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xl text-fg">Or</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <Button variant="secondary" size="lg" onClick={guest}>
              Continue as guest
            </Button>
            {/* The way into the staff console. This is the sign-in surface,
                so it is where an organizer will be looking. */}
            <p className="mt-2 text-base text-fg-muted">
              Are you an organizer?{" "}
              <Link
                href="/host"
                className="font-medium text-fg underline underline-offset-2"
              >
                Staff sign-in
              </Link>
            </p>
          </div>
        ),
      };
      break;

    case "name":
      view = {
        title:
          door === "signup"
            ? "Create your member account"
            : "Login to your account",
        subtitle:
          door === "signup"
            ? method === "icons"
              ? "Your name, then two icons."
              : "Your name, email and a password."
            : "Your name, then your two icons.",
        body: (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameReady) return;
              clearFeedback();
              setStep(method === "icons" ? "icons" : "email");
            }}
            className="flex flex-col gap-6"
          >
            {switcher}
            <TextField
              label="First name"
              placeholder="Enter your first name"
              autoComplete="given-name"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
            <TextField
              label="Last name"
              placeholder="Enter your last name"
              autoComplete="family-name"
              value={last}
              onChange={(e) => setLast(e.target.value)}
            />
            {errorLine}
            <Footer
              secondary={
                door === "signup"
                  ? { label: "Login", onClick: () => enter("login") }
                  : { label: "Cancel", onClick: () => setStep("chooser") }
              }
              primary={{ label: "Next", disabled: !nameReady }}
            />
          </form>
        ),
      };
      break;

    case "icons":
      view = {
        title: door === "signup" ? "Pick your icons" : "Your icons",
        // Said plainly: people were choosing one the way you choose an avatar
        // and then couldn't understand why the wrong one wouldn't let them in.
        subtitle:
          door === "signup"
            ? "Two icons, in order. They are your password."
            : "The two you chose, in the same order.",
        body: (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (picked.length === PICK_COUNT && !busy) void submitIcons();
            }}
            className="flex flex-col gap-6"
          >
            {switcher}
            <IconKeyPicker picked={picked} onToggle={togglePick} />
            {conflict ? (
              forgot ? (
                <div
                  role="status"
                  className="rounded-control border border-line bg-surface-subtle p-4"
                >
                  <p className="text-lg font-medium text-fg">
                    Someone can give you new icons.
                  </p>
                  {/* There is no reset a member can do alone — the icons are
                      the password — so the honest answer is who to ask. */}
                  <p className="mt-1 text-base text-fg-muted">
                    Ask a staff member where you go for programs.
                  </p>
                  <Button className="mt-4" onClick={() => setForgot(false)}>
                    Back
                  </Button>
                </div>
              ) : (
                <div
                  role="alert"
                  className="rounded-control border border-danger-border bg-danger p-4"
                >
                  <p className="text-lg font-medium text-danger-fg">
                    {door === "login"
                      ? "Those icons don't match this name."
                      : "Someone already signs in with that name."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setConflict(false);
                        setPicked([]);
                      }}
                    >
                      Try again
                    </Button>
                    {door === "signup" && (
                      <Button
                        disabled={busy}
                        onClick={() => void submitIcons(true)}
                      >
                        I&apos;m new
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setForgot(true)}>
                      I forgot my icons
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <>
                {errorLine}
                <Footer
                  secondary={{
                    label: "Back",
                    onClick: () => {
                      clearFeedback();
                      setStep("name");
                    },
                  }}
                  primary={{
                    label:
                      door === "signup"
                        ? busy
                          ? "Creating…"
                          : "Create account"
                        : busy
                          ? "Logging in…"
                          : "Login",
                    disabled: busy || picked.length !== PICK_COUNT,
                  }}
                />
              </>
            )}
          </form>
        ),
      };
      break;

    case "email":
      view = {
        title: "Your email",
        subtitle: "You will log in with it.",
        body: (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              clearFeedback();
              setStep("password");
            }}
            className="flex flex-col gap-6"
          >
            {switcher}
            <TextField
              label="Email"
              type="email"
              required
              placeholder="Enter your email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Footer
              secondary={{
                label: "Back",
                onClick: () => {
                  clearFeedback();
                  setStep("name");
                },
              }}
              primary={{ label: "Next", disabled: email.trim() === "" }}
            />
          </form>
        ),
      };
      break;

    case "password":
      view = {
        title: "Set up your password",
        subtitle: `At least ${PASSWORD_MIN_LENGTH} characters.`,
        body: (
          <form
            onSubmit={submitPassword}
            noValidate
            className="flex flex-col gap-6"
          >
            {switcher}
            <TextField
              label="Password"
              type="password"
              required
              placeholder="Enter your password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField
              label="Confirm password"
              type="password"
              required
              placeholder="Re-enter your password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errorLine}
            <Footer
              secondary={{
                label: "Back",
                onClick: () => {
                  clearFeedback();
                  setStep("email");
                },
              }}
              primary={{
                label: busy ? "Creating…" : "Create account",
                disabled: busy || password === "" || confirm === "",
              }}
            />
          </form>
        ),
      };
      break;

    case "credentials":
      view = {
        title: "Login to your account",
        subtitle: "Your email and password.",
        body: (
          <form onSubmit={submitCredentials} className="flex flex-col gap-6">
            {switcher}
            <TextField
              label="Email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errorLine}
            <Footer
              secondary={{ label: "Cancel", onClick: () => setStep("chooser") }}
              primary={{
                label: busy ? "Logging in…" : "Login",
                disabled: busy || email.trim() === "" || password === "",
              }}
            />
          </form>
        ),
      };
      break;

    case "complete":
      view = {
        title: "Account creation complete!",
        subtitle: "You can now save events.",
        icon: (
          <CircleCheck
            aria-hidden="true"
            strokeWidth={1.5}
            className="mb-4 size-12 text-toast-success"
          />
        ),
        body: (
          <div className="flex flex-col gap-6">
            {method === "icons" && (
              <div>
                <p className="text-lg font-medium text-fg">Your login icons</p>
                <ol className="mt-2 flex gap-4">
                  {picked.map((slug, i) => (
                    <li
                      key={slug}
                      className="relative grid size-20 place-items-center rounded-control border-2 border-primary-border bg-primary-soft text-4xl"
                    >
                      <span aria-hidden="true" className="glyph-centred">
                        {emojiFor(slug)}
                      </span>
                      <span className="sr-only">
                        Icon {i + 1}: {slug}
                      </span>
                      <OrderBadge n={i + 1} />
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-base text-fg-muted">
                  Remember them, in this order.
                </p>
              </div>
            )}
            <Button
              variant="primary"
              size="lg"
              onClick={() => onSignedIn({ mode: "signup" })}
            >
              Continue to events
            </Button>
          </div>
        ),
      };
      break;
  }

  return children({
    ...view,
    body: (
      <div ref={bodyRef} className="mt-8">
        {view.body}
      </div>
    ),
  });
}

/** The design's side-by-side pair: outlined on the left, cyan on the right. */
function Footer({
  secondary,
  primary,
}: {
  secondary?: { label: string; onClick: () => void };
  primary: { label: string; disabled?: boolean };
}) {
  // "Back" beside "Create account" is wider than a phone sheet at the
  // design's 20px; a step down in type and padding keeps the pair on one
  // row and the buttons at their full height.
  const half = "flex-1 max-sm:px-4 max-sm:text-lg";
  return (
    <div className="mt-2 flex gap-4">
      {secondary && (
        <Button
          variant="secondary"
          size="lg"
          className={half}
          onClick={secondary.onClick}
        >
          {secondary.label}
        </Button>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className={half}
        disabled={primary.disabled}
      >
        {primary.label}
      </Button>
    </div>
  );
}

function OrderBadge({ n }: { n: number }) {
  // Centred on the corner point itself — half in, half out on both axes —
  // which is the only offset that reads as deliberate at any tile size.
  return (
    <span
      aria-hidden="true"
      className="absolute right-0 top-0 grid size-6 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full bg-primary-strong text-sm font-medium leading-none text-fg"
    >
      {n}
    </span>
  );
}

/**
 * The whole pool — two rows of six, nothing to scroll for — with the two
 * slots above it saying which pick they are on. One grid asked for two icons
 * with nothing saying so read as a single choice that had stopped responding.
 */
function IconKeyPicker({
  picked,
  onToggle,
}: {
  picked: string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <p className="text-lg font-medium text-fg" aria-live="polite">
          {picked.length >= PICK_COUNT
            ? "Both chosen"
            : `Icon ${picked.length + 1} of ${PICK_COUNT}`}
        </p>
        <div className="flex items-center gap-3">
          {Array.from({ length: PICK_COUNT }).map((_, slot) => {
            const slug = picked[slot];
            return (
              <button
                key={slot}
                type="button"
                // Tapping a filled slot takes it back: one press to undo.
                onClick={() => slug && onToggle(slug)}
                disabled={!slug}
                aria-label={
                  slug
                    ? `Icon ${slot + 1}: ${slug}. Activate to remove it.`
                    : `Icon ${slot + 1}: not chosen yet`
                }
                className={`grid size-11 place-items-center rounded-control border-2 text-2xl leading-none disabled:cursor-default ${
                  slug
                    ? "border-primary-border bg-primary-soft"
                    : "border-dashed border-line text-fg-muted"
                }`}
              >
                {slug ? (
                  <span aria-hidden="true" className="glyph-centred">
                    {emojiFor(slug)}
                  </span>
                ) : (
                  <span aria-hidden="true" className="text-base">
                    {slot + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 pt-2 sm:grid-cols-6">
        {ALL_ICONS.map((slug, i) => {
          const order = picked.indexOf(slug);
          const isPicked = order !== -1;
          const full = picked.length >= PICK_COUNT && !isPicked;
          return (
            <button
              key={slug}
              type="button"
              data-focus-first={i === 0 ? "" : undefined}
              onClick={() => onToggle(slug)}
              aria-pressed={isPicked}
              aria-label={
                isPicked
                  ? `${slug}, chosen as icon ${order + 1}. Activate to remove.`
                  : `Choose ${slug} as icon ${picked.length + 1}`
              }
              className={`relative grid aspect-square place-items-center rounded-control border-2 text-3xl leading-none transition-colors ${
                isPicked
                  ? "border-primary-border bg-primary-soft"
                  : full
                    ? "border-line bg-surface opacity-40"
                    : "border-line bg-surface hover:border-primary-border hover:bg-surface-subtle"
              }`}
            >
              <span aria-hidden="true" className="glyph-centred">
                {emojiFor(slug)}
              </span>
              {isPicked && <OrderBadge n={order + 1} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
