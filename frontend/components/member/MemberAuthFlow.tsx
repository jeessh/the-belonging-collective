"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { CircleCheck, HeartHandshake, Mic, UserRound } from "lucide-react";
import { ApiError, api, apiMessage, shortName } from "@/lib/api";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { useDictation } from "@/lib/useDictation";
import { Button } from "@/components/ui/Button";
import { TextField, type TextFieldProps } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import {
  CareLinkForm,
  type CareLinkResult,
} from "@/components/member/CareLinkForm";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export type AuthDoor = "signup" | "login";
export type AuthEntry = "chooser" | AuthDoor;

type Step =
  | "chooser"
  | "who"
  | "name"
  | "email"
  | "password"
  | "credentials"
  // The caregiver path after their own account exists: add the person they
  // support, by creating that account or linking one.
  | "care-choice"
  | "care-create"
  | "care-link"
  | "complete";

/** What the surface around the flow draws: a heading, an optional line under it, and the step itself. */
export type AuthView = {
  title: string;
  subtitle?: string;
  /** Sits above the title on the success screen. */
  icon?: ReactNode;
  body: ReactNode;
};

/**
 * Member sign-up and log-in, one step at a time.
 *
 * Owns the whole state machine — chooser, sign-up (name → email → password),
 * log-in (email + password) and the success screen — and hands each step
 * back as a title plus a body. The in-feed overlay wraps that in a Modal;
 * `/signup` wraps it in a page. Both toast on their own.
 *
 * `onSignedIn` fires once the cookie is set: straight away for a log-in, and
 * from "Continue to events" after an account is created. `onBack` is the
 * success screen's other way out: the account exists and the cookie is set,
 * but the member goes back to what they were looking at instead of on to
 * the feed.
 */
export function MemberAuthFlow({
  initial = "chooser",
  onSignedIn,
  onGuest,
  onBack,
  children,
}: {
  initial?: AuthEntry;
  /** `caregiver` is set when a caregiver account was just created. */
  onSignedIn: (result: { mode: "login" | "signup"; caregiver?: boolean }) => void;
  /** "Continue as guest". Browsing is already open; this just closes the door. */
  onGuest: () => void;
  /** "Go back" on the success screen; left out, the screen has only "Continue". */
  onBack?: () => void;
  children: (view: AuthView) => ReactNode;
}) {
  const toast = useToast();
  const [step, setStep] = useState<Step>(
    initial === "chooser" ? "chooser" : initial === "login" ? "credentials" : "name",
  );
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The address already has an account, so "log in instead" is the fix.
  const [emailTaken, setEmailTaken] = useState(false);
  // Chosen on the "who" step.
  const [caregiver, setCaregiver] = useState(false);
  const [careResult, setCareResult] = useState<CareLinkResult | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Saying a name instead of typing it.
  const dictation = useDictation();
  const [dictating, setDictating] = useState<"first" | "last" | null>(null);
  const [dictationNote, setDictationNote] = useState("");

  function dictate(field: "first" | "last") {
    if (dictating === field) {
      dictation.stop();
      return;
    }
    const label = field === "first" ? "First name" : "Last name";
    setDictating(field);
    setDictationNote(`Listening for ${label.toLowerCase()}`);
    dictation.start((text) => {
      setDictating(null);
      if (text === null) {
        setDictationNote("Microphone blocked");
        return;
      }
      if (!text) {
        setDictationNote("Nothing heard");
        return;
      }
      (field === "first" ? setFirst : setLast)(text);
      setDictationNote(`${label}: ${text}`);
    });
  }

  function clearFeedback() {
    setError(null);
    setEmailTaken(false);
  }

  // Each step lands focus on its first field, else its first button.
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const target =
      root.querySelector<HTMLElement>("input, [data-focus-first]") ??
      root.querySelector<HTMLElement>("button:not([disabled])");
    target?.focus();
  }, [step]);

  function enterLogin() {
    clearFeedback();
    setPassword("");
    setStep("credentials");
  }

  function enterAs(asCaregiver: boolean) {
    clearFeedback();
    setCaregiver(asCaregiver);
    setStep("name");
  }

  function finish(mode: "login" | "signup") {
    if (mode === "login") {
      toast.show({ title: "Successfully logged in!" });
      onSignedIn({ mode });
      return;
    }
    setStep("complete");
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
          is_caregiver: caregiver,
        }),
      });
      // A caregiver's own account is half the job; the other half is the
      // person they support, offered now and again on the profile page.
      if (caregiver) setStep("care-choice");
      else finish("signup");
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

  const errorLine = error && (
    <div role="alert" className="flex flex-col items-start gap-2">
      <p className="text-lg font-medium text-danger-fg">{error}</p>
      {emailTaken && (
        <Button variant="ghost" onClick={enterLogin}>
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
            <Button variant="primary" size="lg" onClick={() => setStep("who")}>
              Create an account
            </Button>
            <Button variant="secondary" size="lg" onClick={enterLogin}>
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

    case "who":
      view = {
        title: "Who are you?",
        subtitle: "A caregiver supports a member and can save programs for them.",
        body: (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <WhoTile
                icon={<UserRound />}
                label="I'm a member"
                hint="I go to programs."
                onClick={() => enterAs(false)}
                focusFirst
              />
              <WhoTile
                icon={<HeartHandshake />}
                label="I'm a caregiver"
                hint="I support someone who does."
                onClick={() => enterAs(true)}
              />
            </div>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setStep("chooser")}
            >
              Back
            </Button>
          </div>
        ),
      };
      break;

    case "name":
      view = {
        title: caregiver
          ? "Create your caregiver account"
          : "Create your member account",
        subtitle: "Your name, email and a password.",
        body: (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameReady) return;
              clearFeedback();
              setStep("email");
            }}
            className="flex flex-col gap-6"
          >
            <NameField
              label="First name"
              placeholder="Enter your first name"
              autoComplete="given-name"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              mic={
                dictation.supported
                  ? {
                      listening: dictating === "first",
                      blocked: dictation.denied,
                      onPress: () => dictate("first"),
                    }
                  : null
              }
            />
            <NameField
              label="Last name"
              placeholder="Enter your last name"
              autoComplete="family-name"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              mic={
                dictation.supported
                  ? {
                      listening: dictating === "last",
                      blocked: dictation.denied,
                      onPress: () => dictate("last"),
                    }
                  : null
              }
            />
            <p role="status" aria-live="polite" className="sr-only">
              {dictationNote}
            </p>
            {errorLine}
            <Footer
              secondary={
                caregiver
                  ? { label: "Back", onClick: () => setStep("who") }
                  : { label: "Login", onClick: enterLogin }
              }
              primary={{ label: "Next", disabled: !nameReady }}
            />
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
            <Link
              href="/forgot"
              className="w-fit text-lg text-fg underline underline-offset-4"
            >
              Forgot your password?
            </Link>
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

    case "care-choice":
      view = {
        title: "Add the person you support?",
        subtitle: "You can also do this later from your profile.",
        body: (
          <div className="flex flex-col gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setStep("care-create")}
            >
              Create their account
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setStep("care-link")}
            >
              Link an existing account
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setStep("complete")}
            >
              Skip
            </Button>
          </div>
        ),
      };
      break;

    case "care-create":
      view = {
        title: "Their account",
        subtitle: "Their name, email and a password. It is theirs to sign in with.",
        body: (
          <CareLinkForm
            mode="create"
            onDone={(result) => {
              setCareResult(result);
              setStep("complete");
            }}
            onCancel={() => setStep("care-choice")}
          />
        ),
      };
      break;

    case "care-link":
      view = {
        title: "Link their account",
        subtitle: "Enter what they use to sign in.",
        body: (
          <CareLinkForm
            mode="link"
            onDone={(result) => {
              setCareResult(result);
              setStep("complete");
            }}
            onCancel={() => setStep("care-choice")}
          />
        ),
      };
      break;

    case "complete":
      view = {
        title: "Account creation complete!",
        subtitle: careResult
          ? `You can now save events for ${shortName(careResult.person)}`
          : "You can now save events.",
        icon: (
          <CircleCheck
            aria-hidden="true"
            strokeWidth={1.5}
            className="mb-4 size-12 text-toast-success"
          />
        ),
        body: (
          <div className="flex gap-4">
            {onBack && (
              <Button
                size="lg"
                className="flex-1 max-sm:px-4 max-sm:text-lg"
                onClick={onBack}
              >
                Go back
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              className="flex-1 max-sm:px-4 max-sm:text-lg"
              onClick={() => onSignedIn({ mode: "signup", caregiver })}
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

/**
 * A name field with a mic beside it, where the browser can listen. `mic` is
 * null where it can't, and the field is the plain one.
 */
function NameField({
  mic,
  ...field
}: TextFieldProps & {
  mic: { listening: boolean; blocked: boolean; onPress: () => void } | null;
}) {
  if (!mic) return <TextField {...field} />;
  return (
    // Bottom-aligned so the button sits beside the input, under the label.
    <div className="flex items-end gap-3">
      <TextField {...field} className="min-w-0 flex-1" />
      <Button
        variant={mic.listening ? "primary" : "secondary"}
        aria-label={
          mic.blocked ? "Microphone blocked" : `Say your ${field.label.toLowerCase()}`
        }
        aria-pressed={mic.listening}
        disabled={mic.blocked}
        onClick={mic.onPress}
        leadingIcon={<Mic />}
        // The input's height: its text-lg line plus py-3 and the border.
        className="h-[3.375rem] px-3"
      />
    </div>
  );
}

/** One of the two big "who are you" choices: icon, short label, one line. */
function WhoTile({
  icon,
  label,
  hint,
  onClick,
  focusFirst = false,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  focusFirst?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-focus-first={focusFirst ? "" : undefined}
      className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-card border-2 border-line bg-surface p-4 text-center transition-colors hover:border-primary-border hover:bg-surface-subtle"
    >
      <span aria-hidden="true" className="text-primary-border [&>svg]:size-10">
        {icon}
      </span>
      <span className="text-xl font-medium text-fg">{label}</span>
      <span className="text-base text-fg-muted">{hint}</span>
    </button>
  );
}
