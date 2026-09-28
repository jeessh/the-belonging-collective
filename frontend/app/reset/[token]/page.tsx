"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, apiMessage } from "@/lib/api";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { FormFooter } from "@/components/member/FormFooter";
import { MemberAuthPage } from "@/components/member/MemberAuthPage";

/** A member choosing a new password from a reset link. Names the account
    first, so someone following a link from an email can see what changes. */
export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<
    { email: string; first_name: string } | null | undefined
  >(undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ email: string; first_name: string }>(`/auth/reset/${token}`)
      .then(setTarget)
      .catch((e) => {
        setTarget(null);
        setProblem(apiMessage(e, "That reset link isn't valid any more."));
      });
  }, [token]);

  async function submit() {
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reset", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      // The endpoint signs them in.
      toast.show({ title: "Password saved. You're logged in." });
      router.replace("/");
    } catch (e) {
      setError(apiMessage(e, "Couldn't set that password. Please try again."));
      setBusy(false);
    }
  }

  if (target === undefined) {
    return (
      <MemberAuthPage title="Checking your link…">
        <p className="sr-only" role="status">
          Loading
        </p>
      </MemberAuthPage>
    );
  }

  if (target === null) {
    return (
      <MemberAuthPage title="This link has expired" subtitle={problem}>
        <FormFooter
          primary={{
            label: "Ask for a new one",
            onClick: () => router.push("/forgot"),
          }}
        />
      </MemberAuthPage>
    );
  }

  return (
    <MemberAuthPage
      title={`Hi ${target.first_name}, choose a new password`}
      subtitle={`You'll log in with ${target.email}. Use at least ${PASSWORD_MIN_LENGTH} characters.`}
    >
      <form
        className="flex flex-col gap-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submit();
        }}
      >
        <TextField
          label="New password"
          type="password"
          autoFocus
          autoComplete="new-password"
          placeholder="Enter your new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <p className="text-base text-fg-muted">
          This logs you out on your other devices.
        </p>
        {error && (
          <p role="alert" className="text-lg text-danger-fg">
            {error}
          </p>
        )}
        <FormFooter
          className="mt-6"
          primary={{
            label: busy ? "Saving…" : "Save new password",
            disabled: busy || password === "" || confirm === "",
          }}
        />
      </form>
    </MemberAuthPage>
  );
}
