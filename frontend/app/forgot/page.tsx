"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, apiMessage } from "@/lib/api";
import { TextField } from "@/components/ui/TextField";
import { FormFooter } from "@/components/member/FormFooter";
import { MemberAuthPage } from "@/components/member/MemberAuthPage";

/**
 * A member asking for a reset link. Confirms in the same words whether or
 * not the address has an account — the endpoint answers identically too.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/auth/forgot", {
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

  const toLogin = () => router.push("/signup?login=1");

  if (sent) {
    return (
      <MemberAuthPage
        title="Check your email"
        subtitle={`If ${email.trim().toLowerCase()} has an account, a link to choose a new password is on its way. It works once and expires in an hour.`}
      >
        <p className="text-lg text-fg-muted">
          Nothing arrived? Check the spam folder, then try again.
        </p>
        <FormFooter
          className="mt-12"
          primary={{ label: "Back to login", onClick: toLogin }}
        />
      </MemberAuthPage>
    );
  }

  return (
    <MemberAuthPage
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to choose a new one."
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && email.trim()) void submit();
        }}
      >
        <TextField
          label="Email"
          type="email"
          autoFocus
          placeholder="Enter your email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-lg text-danger-fg">
            {error}
          </p>
        )}
        <FormFooter
          className="mt-6"
          secondary={{ label: "Back to login", onClick: toLogin }}
          primary={{
            label: busy ? "Sending…" : "Send reset link",
            disabled: busy || !email.trim(),
          }}
        />
      </form>
    </MemberAuthPage>
  );
}
