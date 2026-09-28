"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, apiMessage } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { AuthPage } from "@/components/host/AuthPage";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";

/**
 * Choosing a new password from a reset link.
 *
 * Deliberately the same shape as accepting an invitation — same layout, same
 * two fields, same reassurance about which account is being changed. Someone
 * following a link in an email is right to be wary, and a page that names the
 * account is what separates this from a page that just asks for a password.
 */
export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [target, setTarget] = useState<
    { organization: string; email: string } | null | undefined
  >(undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ organization: string; email: string }>(`/auth/host/reset/${token}`)
      .then(setTarget)
      .catch((e) => {
        setTarget(null);
        setProblem(apiMessage(e, "That reset link isn't valid any more."));
      });
  }, [token]);

  async function submit() {
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/auth/host/reset", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      // The endpoint signs them in, so there is no reason to ask for the
      // password they just chose.
      router.replace("/host/events");
    } catch (e) {
      setError(apiMessage(e, "Couldn't set that password. Please try again."));
      setBusy(false);
    }
  }

  if (target === undefined) {
    return (
      <AuthPage title="Checking your link…">
        <p className="sr-only" role="status">
          Loading
        </p>
      </AuthPage>
    );
  }

  if (target === null) {
    return (
      <AuthPage title="This link has expired">
        <p className="text-lg text-fg-muted">{problem}</p>
        <Link
          href="/host/forgot"
          className="w-fit text-lg text-fg underline underline-offset-4"
        >
          Ask for a new one
        </Link>
      </AuthPage>
    );
  }

  return (
    <AuthPage title="Choose a new password">
      <div className="flex flex-col gap-1">
        <p className="text-lg text-fg">For {target.organization}.</p>
        <p className="text-base text-fg-muted">
          You&apos;ll sign in with {target.email}.
        </p>
      </div>

      <form
        className="flex flex-col gap-4 border-t border-line-active pt-9"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submit();
        }}
      >
        <TextField
          label="New password"
          required
          autoFocus
          type="password"
          autoComplete="new-password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="Confirm password"
          required
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <p className="text-base text-fg-muted">
          At least {PASSWORD_MIN_LENGTH} characters. Anyone still signed in to this account
          elsewhere will be signed out.
        </p>

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
          disabled={busy || password.length < 8 || !confirm}
        >
          {busy ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </AuthPage>
  );
}
