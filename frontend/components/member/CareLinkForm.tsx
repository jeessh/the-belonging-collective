"use client";

import { useState, type FormEvent } from "react";
import {
  ApiError,
  apiMessage,
  createCareMember,
  linkCareMember,
  type CarePerson,
} from "@/lib/api";
import { INVALID_EMAIL, looksLikeEmail } from "@/lib/email";
import { NAME_MAX } from "@/lib/names";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { TextField } from "@/components/ui/TextField";
import { FormFooter } from "@/components/member/FormFooter";

/** What a finished form hands back: who got linked. */
export type CareLinkResult = { person: CarePerson };

/**
 * A caregiver adding the person they support — by creating that person's
 * account (`create`) or by entering the email and password of one that
 * exists (`link`). Either way the account is the member's.
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
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // On the fields themselves, as on the sign-up form.
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const create = mode === "create";
  const ready =
    (!create || (first.trim() !== "" && last.trim() !== "")) &&
    email.trim() !== "" &&
    password !== "" &&
    (!create || confirm !== "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setError(null);
    if (!looksLikeEmail(email)) {
      setEmailError(INVALID_EMAIL);
      return;
    }
    if (create) {
      if (password.length < PASSWORD_MIN_LENGTH) {
        setPasswordError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
        return;
      }
      if (password !== confirm) {
        setConfirmError("The passwords don't match.");
        return;
      }
    }
    setBusy(true);
    try {
      const person = create
        ? await createCareMember({
            first_name: first,
            last_name: last,
            email,
            password,
          })
        : await linkCareMember({ email, password });
      onDone({ person });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setEmailError(INVALID_EMAIL);
      } else {
        setError(apiMessage(err, "Something went wrong. Please try again."));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {create && (
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
          <TextField
            label="Their first name"
            placeholder="Enter their first name"
            autoComplete="off"
            value={first}
            maxLength={NAME_MAX}
            onChange={(e) => setFirst(e.target.value)}
          />
          <TextField
            label="Their last name"
            placeholder="Enter their last name"
            autoComplete="off"
            value={last}
            maxLength={NAME_MAX}
            onChange={(e) => setLast(e.target.value)}
          />
        </div>
      )}
      <TextField
        label="Their email"
        placeholder="Enter their email"
        type="email"
        autoComplete="off"
        value={email}
        error={emailError}
        onChange={(e) => {
          setEmail(e.target.value);
          setEmailError(null);
        }}
      />
      <TextField
        label="Their password"
        placeholder="Enter their password"
        type="password"
        autoComplete={create ? "new-password" : "off"}
        value={password}
        error={passwordError}
        onChange={(e) => {
          setPassword(e.target.value);
          setPasswordError(null);
        }}
      />
      {create && (
        <TextField
          label="Confirm password"
          placeholder="Re-enter their password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          error={confirmError}
          onChange={(e) => {
            setConfirm(e.target.value);
            setConfirmError(null);
          }}
        />
      )}

      {error && (
        <p role="alert" className="text-lg text-danger-fg">
          {error}
        </p>
      )}

      <FormFooter
        className="mt-6"
        secondary={{ label: cancelLabel, onClick: onCancel }}
        primary={{
          label: busy ? "Working…" : create ? "Create account" : "Link",
          disabled: busy || !ready,
        }}
      />
    </form>
  );
}
