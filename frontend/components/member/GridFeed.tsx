"use client";

import { memo } from "react";

/**
 * The console's search field. It sat here from the member grid that no longer
 * exists; it stays only because the console still imports it.
 */
export const SearchBox = memo(function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative block w-full max-w-[420px]">
      <span className="sr-only">Search for event</span>
      <span
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle
            cx="11"
            cy="11"
            r="7"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M20 20l-3.5-3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search for Event"
        className="w-full rounded-xl border border-[#C9C7D2] bg-white py-3 pl-12 pr-4 text-lg text-ink outline-none focus:border-accent"
      />
    </label>
  );
});
