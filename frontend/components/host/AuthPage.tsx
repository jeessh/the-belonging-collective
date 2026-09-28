import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";

/**
 * The organizer door: sign-in, invitation, forgot and reset. One column
 * under the logo, the way the design draws it: a heading, an optional grey
 * line, then the form.
 */
export function AuthPage({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-[704px] flex-col gap-9 sm:gap-12">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-3 rounded-control py-1 text-fg"
        >
          <Brand />
        </Link>
        <div>
          <h1 className="text-2xl font-medium text-fg sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-lg text-fg-muted">{subtitle}</p>}
          <div className="mt-10 flex flex-col gap-9">{children}</div>
        </div>
      </div>
    </main>
  );
}
