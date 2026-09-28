"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Smile } from "lucide-react";
import {
  ApiError,
  apiMessage,
  createCareMember,
  linkCareMember,
  type CarePerson,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { TextField } from "@/components/ui/TextField";
import {
  IconKeyPicker,
  PASSWORD_MIN_LENGTH,
  PICK_COUNT,
  type AuthMethod,
} from "@/components/member/IconKey";

/** What a finished form hands back: who got linked, and their icon key when
    an icon account was just created (empty otherwise). */
export type CareLinkResult = { person: CarePerson; icons: string[] };

/**
 * A caregiver adding the person they support — by creating that person's
 * account (`create`) or by entering the credential of one that exists
 * (`link`). Either way the account is the member's: the Icons | Password
 * switch is the same one sign-up offers, and the credential is theirs.
 *
 * Used inside the sign-up flow and on the profile page, so it draws only the
 * form; the surface around it owns the heading.
 */
export function CareLinkForm({
  mode,
  onDone,
  onCancel,
  cancelLabel = "Back",
}: {
  mode: "create" | "link";
  onDone: (result: CareLinkResult) => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const [method, setMethod] = useState<AuthMethod>("icons");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = mode === "create";
  // Linking by password needs only the email — the name is on the account.
  const needsName = create || method === "icons";
  const nameReady = first.trim() !== "" && last.trim() !== "";

  function togglePick(slug: string) {
    setError(null);
    setPicked((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= PICK_COUNT) return prev;
      return [...prev, slug];
    });
  }

  function chooseMethod(next: AuthMethod) {
    setMethod(next);
    setPicked([]);
    setError(null);
  }

  const ready =
    (!needsName || nameReady) &&
    (method === "icons"
      ? picked.length === PICK_COUNT
      : email.trim() !== "" && password !== "" && (!create || confirm !== ""));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setError(null);
    if (create && method === "password") {
      if (password.length < PASSWORD_MIN_LENGTH) {
        setError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
        return;
      }
      if (password !== confirm) {
        setError("The passwords don't match.");
        return;
      }
    }
    setBusy(true);
    try {
      if (create) {
        const made = await createCareMember({
          first_name: first,
          last_name: last,
          ...(method === "icons" ? { icons: picked } : { email, password }),
        });
        onDone({ person: made, icons: made.icons });
      } else {
        const person = await linkCareMember(
          method === "icons"
            ? { first_name: first, last_name: last, icons: picked }
            : { email, password },
        );
        onDone({ person, icons: [] });
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 422
          ? "Enter a valid email address."
          : apiMessage(err, "Something went wrong. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <SegmentedToggle
          label="Their sign-in method"
          shape="pill"
          value={method}
          onChange={chooseMethod}
          segments={[
            { value: "icons", label: "Icons", icon: <Smile />, iconOnly: true },
            { value: "password", label: "Password", icon: <KeyRound />, iconOnly: true },
          ]}
        />
        <span aria-hidden="true" className="text-lg text-fg-muted">
          {method === "icons" ? "Icons" : "Password"}
        </span>
      </div>

      {needsName && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Their first name"
            autoComplete="off"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
          <TextField
            label="Their last name"
            autoComplete="off"
            value={last}
            onChange={(e) => setLast(e.target.value)}
          />
        </div>
      )}

      {method === "icons" ? (
        <div>
          <p className="mb-3 text-lg text-fg-muted">
            {create
              ? "Two icons, in order. They are their password."
              : "The two they sign in with, in order."}
          </p>
          <IconKeyPicker picked={picked} onToggle={togglePick} />
        </div>
      ) : (
        <>
          <TextField
            label="Their email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Their password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {create && (
            <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-lg font-medium text-danger-fg">
          {error}
        </p>
      )}

      <div className="mt-2 flex gap-4">
        <Button
          variant="secondary"
          size="lg"
          className="flex-1 max-sm:px-4 max-sm:text-lg"
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="flex-1 max-sm:px-4 max-sm:text-lg"
          disabled={busy || !ready}
        >
          {busy ? "Working…" : create ? "Create account" : "Link"}
        </Button>
      </div>
    </form>
  );
}
