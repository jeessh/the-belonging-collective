"use client";

import { useState } from "react";
import Link from "next/link";
import { api, apiMessage } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { AuthPage } from "@/components/host/AuthPage";

/**
 * Ask for a reset link.
 *
 * Confirms in the same words whether or not the address has an account —
 * the endpoint answers identically for the same reason, so that asking here
 * can't be used to find out which agencies are on the platform.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/auth/host/forgot", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setSent(true);
    } catch (e) {
      setError(apiMessage(e, "Couldn't send a reset link. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const backToSignIn = (
    <Link href="/host" className="w-fit text-lg text-fg underline underline-offset-4">
      Back to sign in
    </Link>
  );

  return (
    <AuthPage title="Reset your password">
      {sent ? (
        <>
          <div className="flex flex-col gap-3">
            <p className="text-lg text-fg">
              If <strong>{email.trim().toLowerCase()}</strong> has an account,
              a reset link is on its way. It works once and expires in an hour.
            </p>
            <p className="text-lg text-fg-muted">
              Nothing arrived? Check the spam folder, then try again — the
              address has to match the one the account was set up with.
            </p>
          </div>
          {backToSignIn}
        </>
      ) : (
        <>
          <p className="text-lg text-fg-muted">
            We&apos;ll email you a link to choose a new one.
          </p>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy && email.trim()) void submit();
            }}
          >
            <TextField
              label="Email"
              type="email"
              autoFocus
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-base text-danger-fg">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-2"
              disabled={busy || !email.trim()}
            >
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          {backToSignIn}
        </>
      )}
    </AuthPage>
  );
}
