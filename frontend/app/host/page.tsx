"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { AuthPage } from "@/components/host/AuthPage";

// Sign-in only. There is no self-serve organizer registration: a superadmin
// creates accounts from Admin console → Admins. Anyone being able to register
// meant anyone could publish programs to the member feed.
export default function HostAuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login/host", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/host/events");
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setError("Enter a valid email and password.");
      } else {
        setError("Wrong email or password.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPage title="Login to the admin console">
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && email && password) void submit();
        }}
      >
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="text-lg text-danger-fg">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-4"
          disabled={busy || !email || !password}
        >
          {busy ? "Logging in…" : "Login"}
        </Button>
      </form>

      <div className="flex flex-col gap-3 text-lg">
        <Link
          href="/host/forgot"
          className="w-fit text-fg underline underline-offset-4"
        >
          Forgot your password?
        </Link>
        <p className="text-fg-muted">
          Need an account? Ask a superadmin at your organization to create one.
        </p>
      </div>
    </AuthPage>
  );
}
