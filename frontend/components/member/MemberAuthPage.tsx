import type { ReactNode } from "react";

/**
 * The member door as a page: /signup, /forgot and /reset. The same card as
 * the in-feed sign-in dialog — width, padding, heading, grey subtext — so the
 * two ways in look like one thing.
 */
export function MemberAuthPage({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Sits above the title, as on the account-created screen. */
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface-subtle px-4 py-8">
      <section className="w-full max-w-[800px] rounded-card border border-line bg-surface p-6 shadow-lift sm:p-12">
        {icon}
        <h1 className="text-2xl font-medium text-fg sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 text-lg text-fg-muted">{subtitle}</p>}
        <div className="mt-10">{children}</div>
      </section>
    </main>
  );
}
