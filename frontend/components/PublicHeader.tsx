import Link from "next/link";
import { Brand } from "@/components/Brand";
import { buttonClass } from "@/components/ui/Button";

/**
 * The top of the pages people reach from a link — a program's own page and a
 * shared list — where they may never have seen the app: whose site this is,
 * and the way in to the rest of it.
 */
export function PublicHeader() {
  return (
    <header className="border-b border-line-card bg-surface">
      <div className="mx-auto flex w-full max-w-[960px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 text-fg"
          aria-label="The Belonging Collective home"
        >
          <Brand />
        </Link>
        <Link href="/" className={buttonClass("secondary", "md", "max-sm:hidden")}>
          Find programs
        </Link>
      </div>
    </header>
  );
}
