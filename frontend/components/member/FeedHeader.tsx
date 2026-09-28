"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Compass,
  LogOut,
  PersonStanding,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { categoryStyle } from "@/lib/categories";
import { useCategories } from "@/lib/useCategories";
import { SELECTABLE_TAGS } from "@/lib/accessibility";
import { shortName, type CarePerson } from "@/lib/api";

/** Whose list saves go into: the caregiver's own (null) or a linked member's. */
export type CareChoice = {
  members: CarePerson[];
  selected: CarePerson | null;
  onSelect: (member: CarePerson | null) => void;
};

/**
 * The feed's top bar: who you are on the left, Accessibility Tools on the
 * right. Signed out, the name is the way in.
 */
/** The member's chosen picture, if any — see components/ui/Avatar. */
export type AvatarChoice = {
  url?: string | null;
  emblem?: string | null;
};

export const FeedHeader = memo(function FeedHeader({
  name,
  avatar,
  care,
  onSignIn,
  onSignOut,
  children,
}: {
  /** "Sophie L.", or null when nobody is signed in. */
  name: string | null;
  avatar?: AvatarChoice | null;
  /** Only for a caregiver with linked members; the switcher is hidden otherwise. */
  care?: CareChoice | null;
  onSignIn: () => void;
  onSignOut: () => void;
  /** The Accessibility Tools menu. */
  children: ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3 sm:gap-4 sm:px-6 sm:py-5 lg:px-9">
      <div className="flex min-w-0 items-center gap-1 sm:gap-3">
        <AccountButton
          name={name}
          avatar={avatar}
          // Beside the switcher a phone has room for the picture, not the
          // name; the menu still carries it.
          compact={!!care && care.members.length > 0}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
        />
        {care && care.members.length > 0 && <CareSwitcher {...care} />}
      </div>
      {children}
    </header>
  );
});

/**
 * "Saving for: Me ▾". Compact on purpose — it sits in the header next to the
 * name — and it only appears for a caregiver who has someone linked.
 */
function CareSwitcher({ members, selected, onSelect }: CareChoice) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = selected ? shortName(selected) : "Me";
  const item =
    "flex min-h-12 w-full items-center gap-3 px-4 text-left text-lg text-fg transition-colors hover:bg-surface-subtle";

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Saving for ${current}`}
        className={`inline-flex min-h-11 max-w-[11rem] items-center gap-2 rounded-control border px-3 py-1 text-base transition-colors sm:max-w-none sm:text-lg ${
          selected
            ? "border-primary-border bg-primary-soft"
            : "border-line bg-surface hover:bg-surface-subtle"
        }`}
      >
        <span className="hidden text-fg-muted sm:inline">Saving for:</span>
        <span className="truncate font-medium text-fg">{current}</span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-fg-icon" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Save programs for"
          // Right-anchored on a phone, where the switcher sits near the
          // middle and a left-anchored menu would run off the edge.
          className="absolute right-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-control border border-line bg-surface py-1 shadow-lift sm:left-0 sm:right-auto"
        >
          <button
            role="menuitemradio"
            aria-checked={selected === null}
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              onSelect(null);
            }}
          >
            <Avatar name="Me" size={28} />
            <span className="flex-1">Me</span>
            {selected === null && <Check aria-hidden="true" className="size-5" />}
          </button>
          {members.map((m) => {
            const on = selected?.id === m.id;
            return (
              <button
                key={m.id}
                role="menuitemradio"
                aria-checked={on}
                type="button"
                className={item}
                onClick={() => {
                  setOpen(false);
                  onSelect(m);
                }}
              >
                <Avatar
                  name={shortName(m)}
                  src={m.avatar_url}
                  emblem={m.avatar_emblem}
                  size={28}
                />
                <span className="flex-1 truncate">{shortName(m)}</span>
                {on && <Check aria-hidden="true" className="size-5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Signed out it signs you in. Signed in it opens a menu, because pressing your
 * own name used to sign you out on the spot, with no label saying so.
 */
function AccountButton({
  name,
  avatar,
  compact = false,
  onSignIn,
  onSignOut,
}: {
  name: string | null;
  avatar?: AvatarChoice | null;
  /** Hide the name below `sm`; the picture stands in for it. */
  compact?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const signedIn = name !== null;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => (signedIn ? setOpen((v) => !v) : onSignIn())}
        aria-haspopup={signedIn ? "menu" : undefined}
        aria-expanded={signedIn ? open : undefined}
        className="inline-flex min-h-11 max-w-full items-center gap-3 rounded-control py-1 pl-1 pr-3 text-xl transition-colors hover:bg-surface-subtle sm:gap-4"
      >
        <Avatar
          name={name}
          src={avatar?.url}
          emblem={avatar?.emblem}
          size={36}
        />
        <span
          className={`truncate ${signedIn ? "text-fg" : "text-fg-muted"} ${
            compact ? "max-sm:sr-only" : ""
          }`}
        >
          {name ?? "Not Logged In"}
        </span>
        {signedIn && (
          <ChevronDown aria-hidden="true" className="size-5 text-fg-icon" />
        )}
      </button>

      {open && signedIn && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 min-w-[200px] overflow-hidden rounded-control border border-line bg-surface py-1 shadow-lift"
        >
          <Link
            role="menuitem"
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-lg text-fg transition-colors hover:bg-surface-subtle"
          >
            <UserRound aria-hidden="true" className="size-5" />
            Profile
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-lg text-fg transition-colors hover:bg-surface-subtle"
          >
            <LogOut aria-hidden="true" className="size-5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- accessibility tools ---------------- */

export const AccessibilityMenu = memo(function AccessibilityMenu({
  open,
  onOpenChange,
  ttsEnabled,
  voiceEnabled,
  ttsSupported,
  voiceSupported,
  onToggleTts,
  onToggleVoice,
  headEnabled,
  headSupported,
  onToggleHead,
  listening,
  lastHeard,
  interests,
  onToggleInterest,
  accessPrefs,
  onToggleAccessPref,
  signedIn,
  onSignIn,
  onShowTour,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ttsEnabled: boolean;
  voiceEnabled: boolean;
  ttsSupported: boolean;
  voiceSupported: boolean;
  onToggleTts: (v: boolean) => void;
  onToggleVoice: (v: boolean) => void;
  headEnabled: boolean;
  headSupported: boolean;
  onToggleHead: (v: boolean) => void;
  listening: boolean;
  /** The recognizer's most recent transcript, for the voice hint. */
  lastHeard: string;
  interests: string[];
  onToggleInterest: (label: string) => void;
  /** Slugs from lib/accessibility — what the member needs a program to offer. */
  accessPrefs: string[];
  onToggleAccessPref: (slug: string, label: string) => void;
  signedIn: boolean;
  onSignIn: () => void;
  /** Replays the first-run tour. */
  onShowTour: () => void;
}) {
  const { categories, label: topicLabel } = useCategories();
  // Escape closes it and focus returns to the trigger. Capture, without
  // stopping propagation, matching the other menus on this surface.
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      onOpenChange(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onOpenChange]);

  return (
    <div className="relative">
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-40 cursor-default"
        />
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-tour="a11y"
        className="relative inline-flex min-h-11 items-center gap-3 rounded-control px-2 py-1 text-xl text-fg transition-colors hover:bg-surface-subtle"
      >
        <PersonStanding aria-hidden="true" className="size-10 shrink-0" />
        <span className="hidden sm:inline">Accessibility Tools</span>
        <span className="sr-only sm:hidden">Accessibility Tools</span>
        <ChevronDown aria-hidden="true" className="size-5 text-fg-icon" />
        {listening && (
          <span
            aria-hidden
            className="absolute -bottom-1 left-6 grid size-5 place-items-center rounded-full bg-primary-strong text-[10px]"
          >
            🎤
          </span>
        )}
      </button>

      {open && (
        <div
          // Not role="menu": this holds headings and switches, none of which
          // are menuitems.
          role="dialog"
          aria-label="Accessibility Tools"
          className="absolute right-0 top-full z-50 mt-2 max-h-[80vh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-card border border-line bg-surface p-5 shadow-lift"
        >
          <h2 className="text-xl font-medium text-fg">Accessibility</h2>
          <div className="mt-1 flex flex-col divide-y divide-line-card">
            <MenuToggle
              label="Read aloud"
              hint="Speaks each event as you browse."
              checked={ttsEnabled}
              disabled={!ttsSupported}
              disabledHint="Not supported in this browser."
              onChange={onToggleTts}
            />
            <MenuToggle
              label="Voice commands"
              hint={
                // What it actually heard, once it has heard anything, so "it
                // isn't working" and "it heard something else" look different.
                listening && lastHeard
                  ? `Heard “${lastHeard}”. Say “next”, “back”, “save”, or “list”.`
                  : 'Say “next”, “back”, “save”, or “list”.'
              }
              checked={voiceEnabled}
              disabled={!voiceSupported}
              disabledHint="Not supported here (try Chrome or Edge)."
              onChange={onToggleVoice}
            />
            <MenuToggle
              label="Head tracking"
              hint="Turn your head to an edge: up and down move, left saves, right opens your list."
              checked={headEnabled}
              disabled={!headSupported}
              disabledHint="Needs a webcam on Chrome or Edge over https."
              onChange={onToggleHead}
            />
          </div>

          <Button
            className="mt-4 w-full"
            onClick={onShowTour}
            leadingIcon={<Compass />}
          >
            Show me around
          </Button>

          <h2 className="mt-6 text-xl font-medium text-fg">What you like</h2>
          <p className="text-base text-fg-muted">
            These come first in your programs.
          </p>
          {/* Topics live on a profile, so there is nowhere to put them without
              an account. The switches above need no account. */}
          {!signedIn ? (
            <Button variant="primary" className="mt-3 w-full" onClick={onSignIn}>
              Sign in to pick topics
            </Button>
          ) : (
            <>
              <div
                role="group"
                aria-label="Things you are interested in"
                className="mt-3 flex flex-wrap gap-2"
              >
                {categories.map(({ slug, label }) => (
                  <Chip
                    key={slug}
                    pressed={interests.includes(slug)}
                    onClick={() => onToggleInterest(slug)}
                  >
                    <span aria-hidden>{categoryStyle(slug).emoji}</span>
                    {label}
                  </Chip>
                ))}
              </div>
              <p className="sr-only" role="status" aria-live="polite">
                {interests.length === 0
                  ? "Nothing chosen yet"
                  : `${interests.length} chosen: ${interests.map(topicLabel).join(", ")}`}
              </p>

              {/* Needs, not tastes — they sort harder than topics do (see
                  ACCESS_WEIGHT in lib/feed). Still only sorting. */}
              <h2 className="mt-6 text-xl font-medium text-fg">What you need</h2>
              <p className="text-base text-fg-muted">
                Programs that offer these come first.
              </p>
              <div
                role="group"
                aria-label="Things you need a program to offer"
                className="mt-3 flex flex-wrap gap-2"
              >
                {SELECTABLE_TAGS.map(({ slug, label, emoji }) => (
                  <Chip
                    key={slug}
                    pressed={accessPrefs.includes(slug)}
                    onClick={() => onToggleAccessPref(slug, label)}
                  >
                    <span aria-hidden>{emoji}</span>
                    {label}
                  </Chip>
                ))}
              </div>
              <p className="sr-only" role="status" aria-live="polite">
                {accessPrefs.length === 0
                  ? "Nothing chosen yet"
                  : `${accessPrefs.length} chosen`}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
});

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`inline-flex min-h-11 items-center gap-2 rounded-control border px-3 py-2 text-base text-fg transition-colors ${
        pressed
          ? "border-primary-border bg-primary-soft"
          : "border-line bg-surface hover:bg-surface-subtle"
      }`}
    >
      {children}
    </button>
  );
}

function MenuToggle({
  label,
  hint,
  checked,
  disabled,
  disabledHint,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div>
        <p className="text-lg text-fg">{label}</p>
        <p className="text-sm text-fg-muted">
          {disabled ? disabledHint ?? hint : hint}
        </p>
      </div>
      {/* The track is 44×24; the button around it is 44×44, because these are
          the controls the people this app is for most need to hit. */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="grid size-11 shrink-0 place-items-center disabled:opacity-40"
      >
        <span
          className={`relative block h-6 w-11 rounded-full transition-colors ${
            checked ? "bg-primary-strong" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
              checked ? "left-[22px]" : "left-0.5"
            }`}
          />
        </span>
      </button>
    </div>
  );
}
