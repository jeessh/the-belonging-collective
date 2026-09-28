import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/Brand";

/**
 * The organizer door: sign-in, invitation, forgot and reset. One column
 * under the logo, the way the design draws it, in the console's tokens.
 */
export function AuthPage({
  title,
  children,
}: {
  title: ReactNode;
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
        <div className="flex flex-col gap-9">
          <h1 className="text-3xl font-medium text-fg">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
