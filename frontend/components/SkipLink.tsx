"use client";

/**
 * "Skip to content", the first tab stop on every page. Jumps to the page's
 * <main>, whichever page this is, rather than relying on each one to carry
 * an id: past the header and filters, which are a dozen tabs or more.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      onClick={(e) => {
        const main = document.querySelector<HTMLElement>("main");
        if (!main) return;
        e.preventDefault();
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
        main.focus();
      }}
      className="sr-only rounded-control border-2 border-primary-border bg-primary px-4 py-2 text-lg font-medium text-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90]"
    >
      Skip to content
    </a>
  );
}
