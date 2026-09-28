import type { ReactNode } from "react";

/** The member door's full-page card — the same one /signup draws. */
export function MemberAuthPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface-subtle px-4 py-8">
      <section className="flex w-full max-w-lg flex-col gap-6 rounded-card border border-line bg-surface p-6 shadow-lift sm:p-10">
        <div>
          <h1 className="text-2xl font-medium text-fg sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-lg text-fg-muted">{subtitle}</p>}
        </div>
        {children}
      </section>
    </main>
  );
}
