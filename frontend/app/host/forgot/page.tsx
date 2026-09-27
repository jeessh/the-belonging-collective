"use client";

import { useState } from "react";
import Link from "next/link";
import { api, apiMessage } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

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

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-6 py-12">
      <div className="w-full max-w-[520px]">
        <p className="text-base uppercase tracking-wide text-fg-muted">
          Admin console
        </p>
        <h1 className="mt-1 text-4xl font-medium text-fg">
          Reset your password
        </h1>

        {sent ? (
          <>
            <p className="mt-4 text-lg text-fg">
              If <strong>{email.trim().toLowerCase()}</strong> has an account,
              a reset link is on its way. It works once and expires in an hour.
            </p>
            <p className="mt-3 text-lg text-fg-muted">
              Nothing arrived? Check the spam folder, then try again — the
              address has to match the one the account was set up with.
            </p>
            <Link
              href="/host"
              className="mt-5 inline-block text-lg text-fg underline underline-offset-4"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-lg text-fg-muted">
              We&apos;ll email you a link to choose a new one.
            </p>
            <form
              className="mt-5 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!busy && email.trim()) void submit();
              }}
            >
              <TextField
                label="Email"
                type="email"
                autoFocus
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
                disabled={busy || !email.trim()}
              >
                {busy ? "Sending…" : "Send reset link"}
              </Button>
            </form>
            <Link
              href="/host"
              className="mt-5 inline-block text-lg text-fg underline underline-offset-4"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
