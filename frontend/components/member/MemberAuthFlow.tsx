"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { CircleCheck, Mic } from "lucide-react";
import { ApiError, api, apiMessage, shortName } from "@/lib/api";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { useDictation } from "@/lib/useDictation";
import { Button } from "@/components/ui/Button";
import { TextField, type TextFieldProps } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { FormFooter } from "@/components/member/FormFooter";
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
 * Owns the whole state machine — chooser, account type, sign-up (name →
 * email → password), log-in (email + password) and the success screen — and
 * hands each step back as a title plus a body. The in-feed overlay wraps that
 * in a Modal; `/signup` wraps it in a page. Both toast on their own.
 *
 * As the design draws it, every sign-up step's left button is Login and the
 * × (or the chooser) is the way back; there is no Back between steps.
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
  onGuestSignIn,
  onBack,
  children,
}: {
  initial?: AuthEntry;
  /** `caregiver` is set when a caregiver account was just created. */
  onSignedIn: (result: { mode: "login" | "signup"; caregiver?: boolean }) => void;
  /** "Continue as guest". Browsing is already open; this just closes the door. */
  onGuest: () => void;
  /** The guest toast's "Sign up/Login": bring the chooser back. */
  onGuestSignIn: () => void;
  /** "Go back" on the success screen; left out, the screen has only "Continue". */
  onBack?: () => void;
  children: (view: AuthView) => ReactNode;
}) {
  const toast = useToast();
  const [step, setStep] = useState<Step>(
    initial === "chooser" ? "chooser" : initial === "login" ? "credentials" : "who",
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
  // The account type card chosen on the "who" step.
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

  function go(next: Step) {
    clearFeedback();
    setStep(next);
  }

  function enterLogin() {
    setPassword("");
    go("credentials");
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
      title: "You're logged in as a guest!",
      description: "Login or sign up to save events.",
      tone: "info",
      cancel: { label: "Later" },
      action: { label: "Sign up/Login", onClick: onGuestSignIn },
    });
    onGuest();
  }

  const nameReady = first.trim() !== "" && last.trim() !== "";

  const errorLine = error && (
    <div role="alert" className="flex flex-col items-start gap-2">
      <p className="text-lg text-danger-fg">{error}</p>
      {emailTaken && (
        <Button variant="ghost" onClick={enterLogin}>
          Login instead
        </Button>
      )}
    </div>
  );

  const loginAside = { label: "Login", onClick: enterLogin };

  let view: AuthView;

  switch (step) {
    case "chooser":
      view = {
        title: "You're not logged in!",
        subtitle: "Create an account to save events to your page and calendar",
        body: (
          <div className="flex flex-col gap-4">
            <Button variant="primary" size="lg" onClick={() => go("who")}>
              Create an account
            </Button>
            <Button variant="secondary" size="lg" onClick={enterLogin}>
              Login
            </Button>
            <div aria-hidden="true" className="flex items-center gap-6 py-2">
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
              Organizer?{" "}
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
        title: "Account type",
        subtitle: "Choose the one that fits you.",
        body: (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go("name");
            }}
          >
            <fieldset className="flex flex-col gap-4">
              <legend className="sr-only">Account type</legend>
              <RoleCard
                name="Community Member"
                hint="Finds and saves programs to go to."
                checked={!caregiver}
                onChange={() => setCaregiver(false)}
              />
              <RoleCard
                name="Caregiver"
                hint="Saves programs for someone they support."
                checked={caregiver}
                onChange={() => setCaregiver(true)}
              />
            </fieldset>
            <FormFooter
              className="mt-12"
              secondary={loginAside}
              primary={{ label: "Next" }}
            />
          </form>
        ),
      };
      break;

    case "name":
      view = {
        title: caregiver
          ? "Create your caregiver account"
          : "Create your member account",
        subtitle: caregiver
          ? "Save events for the people you support."
          : "Save the events you want to go to.",
        body: (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (nameReady) go("email");
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
            <FormFooter
              className="mt-6"
              secondary={loginAside}
              primary={{ label: "Next", disabled: !nameReady }}
            />
          </form>
        ),
      };
      break;

    case "email":
      view = {
        title: "Provide your email",
        subtitle: "You will log in with it and get reminders for saved events",
        body: (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go("password");
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
            <FormFooter
              className="mt-6"
              secondary={loginAside}
              primary={{ label: "Next", disabled: email.trim() === "" }}
            />
          </form>
        ),
      };
      break;

    case "password":
      view = {
        title: "Set up your password",
        subtitle: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
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
            <FormFooter
              className="mt-6"
              secondary={loginAside}
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
        subtitle: "Please login with your email and password.",
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
            <FormFooter
              className="mt-6"
              secondary={{ label: "Cancel", onClick: () => go("chooser") }}
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
        subtitle: "Their name, email and a password. They use these to sign in.",
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
          ? `You're now free to browse and save events for ${shortName(careResult.person)}`
          : "You're now free to browse and save events",
        icon: (
          <CircleCheck
            aria-hidden="true"
            strokeWidth={2}
            className="mb-6 size-12 text-toast-success"
          />
        ),
        body: (
          <FormFooter
            secondary={onBack && { label: "Go back", onClick: onBack }}
            primary={{
              label: "Continue to events",
              onClick: () => onSignedIn({ mode: "signup", caregiver }),
            }}
          />
        ),
      };
      break;
  }

  return children({
    ...view,
    body: <div ref={bodyRef}>{view.body}</div>,
  });
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
        // The input box's height.
        className="h-12"
      />
    </div>
  );
}

/**
 * The sheet's account-type card: a grey block with a name and a grey line,
 * cyan when chosen. A real radio underneath, so arrow keys move between the
 * two and the form submits with Enter.
 */
function RoleCard({
  name,
  hint,
  checked,
  onChange,
}: {
  name: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name="account-type"
        className="peer sr-only"
        checked={checked}
        onChange={onChange}
      />
      <span className="flex flex-col gap-2 rounded-control border border-line bg-surface-subtle p-6 transition-colors peer-checked:border-primary-border peer-checked:bg-primary-soft peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#5b5bd6]">
        <span className="text-xl font-medium text-fg">{name}</span>
        <span className="text-base text-fg-muted">{hint}</span>
      </span>
    </label>
  );
}
