"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError, api, apiMessage } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { AuthPage } from "@/components/host/AuthPage";

/**
 * Accepting an invitation — to join as an organization, or as one person on
 * an organization's team (`staff`).
 *
 * The password is set here, by the person who will use it. That's the whole
 * point of inviting rather than creating an account and reading a password out:
 * nobody else ever knows it.
 */
export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<
    | { organization: string; email: string; name?: string | null; staff: boolean }
    | null
    | undefined
  >(undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{
      organization: string;
      email: string;
      name?: string | null;
      staff: boolean;
    }>(`/invites/${token}`)
      .then(setInvite)
      .catch((e) => {
        setInvite(null);
        setProblem(
          apiMessage(e, "That invitation link isn't valid any more."),
        );
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
      await api("/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      // Accepting signs them in, so there's nowhere to go but the console.
      router.replace("/host/events");
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 422
          ? "Use at least 8 characters."
          : apiMessage(e, "Couldn't set that up. Please try again."),
      );
      setBusy(false);
    }
  }

  if (invite === undefined) {
    return (
      <AuthPage title="Checking your invite…">
        <p className="sr-only" role="status">
          Loading
        </p>
      </AuthPage>
    );
  }

  if (invite === null) {
    return (
      <AuthPage title="This link has expired">
        <div className="flex flex-col gap-3 text-lg text-fg-muted">
          <p>{problem}</p>
          <p>Ask whoever invited you to send a new one.</p>
        </div>
      </AuthPage>
    );
  }

  return (
    <AuthPage
      title={`Welcome, ${invite.staff ? invite.name || invite.email : invite.organization}`}
    >
      {/* Showing who they are and who invited them is what separates this
          from a phishing link that just asks for a password. */}
      <div className="flex flex-col gap-1">
        <p className="text-lg text-fg">
          {invite.staff
            ? `You've been invited to join ${invite.organization}'s team on The Belonging Collective.`
            : "You've been invited to post events on The Belonging Collective."}{" "}
          Choose a password and you&apos;re in.
        </p>
        <p className="text-base text-fg-muted">
          You&apos;ll sign in with {invite.email}.
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
          label="Set password"
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
          {busy ? "Setting up…" : "Create my account"}
        </Button>
      </form>
    </AuthPage>
  );
}
