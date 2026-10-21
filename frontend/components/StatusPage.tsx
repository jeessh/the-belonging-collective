import type { ReactNode } from "react";
import { PublicHeader } from "@/components/PublicHeader";

/**
 * A whole page that only says one thing — not found, something broke, the
 * server is unreachable — with the site's header so nobody is stranded on a
 * blank screen with no way back.
 */
export function StatusPage({
  title,
  message,
  actions,
}: {
  title: string;
  message: string;
  actions: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface-subtle text-fg">
      <PublicHeader />
      <main
        id="main"
        className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-4 px-4 py-16 text-center sm:px-6"
      >
        <h1 className="text-3xl font-medium sm:text-4xl">{title}</h1>
        <p className="text-xl text-fg-muted">{message}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">{actions}</div>
      </main>
    </div>
  );
}
