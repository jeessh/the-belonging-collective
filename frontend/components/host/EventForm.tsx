"use client";

import { useState, type ReactNode } from "react";
import type { Event, EventLink } from "@/lib/api";
import { ImageDrop } from "@/components/ImageDrop";
import { TextField } from "@/components/ui/TextField";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { checkPostingLink } from "@/lib/postingLink";
import { CATEGORIES } from "@/lib/categories";
import { SELECTABLE_TAGS, isDerivedTag } from "@/lib/accessibility";
import {
  PAID_MODELS,
  centsFrom,
  dollarsFrom,
  templateFor,
  type PricingModel,
} from "@/lib/pricing";
import { FREQUENCIES, type Frequency } from "@/lib/recurrence";

/** Mirrors DESCRIPTION_MAX and LINKS_MAX in app/schemas/event.py. */
export const DESCRIPTION_MAX = 1000;
export const LINKS_MAX = 3;

export type EventFormValues = {
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  description: string;
  notes: string;
  /** The typed sign-up link — where "Registration" sends people. */
  registrationUrl: string;
  /** Always LINKS_MAX rows; blank rows are dropped on save. */
  links: EventLink[];
  coverImageUrl: string;
  categories: string[];
  activityType: string;
  capacity: string;
  minAge: string;
  maxAge: string;
  frequency: Frequency;
  occurrenceCount: string;
  repeatForever: boolean;
  pricingModel: PricingModel;
  priceAmount: string;
  priceGroupSize: string;
  priceSessions: string;
  priceNote: string;
  requiresSignup: boolean;
  isVirtual: boolean;
  isYouth: boolean;
  /**
   * What the program offers. Holds only the non-derived tags: `free` and
   * `no_registration` are written from the cost and drop-in answers instead.
   */
  accessibilityTags: string[];
};

const EMPTY_LINKS = (): EventLink[] =>
  Array.from({ length: LINKS_MAX }, () => ({ label: "", url: "" }));

export const EMPTY_FORM: EventFormValues = {
  title: "",
  date: "",
  time: "",
  endTime: "",
  location: "",
  description: "",
  notes: "",
  registrationUrl: "",
  links: EMPTY_LINKS(),
  coverImageUrl: "",
  categories: [],
  activityType: "",
  capacity: "",
  minAge: "",
  maxAge: "",
  frequency: "once",
  occurrenceCount: "",
  repeatForever: false,
  pricingModel: "free",
  priceAmount: "",
  priceGroupSize: "",
  priceSessions: "",
  priceNote: "",
  requiresSignup: false,
  isVirtual: false,
  isYouth: false,
  accessibilityTags: [],
};

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function valuesFromEvent(event: Event): EventFormValues {
  const start = event.starts_at ? new Date(event.starts_at) : null;
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const links = EMPTY_LINKS();
  (event.links ?? []).slice(0, LINKS_MAX).forEach((l, i) => (links[i] = l));
  return {
    title: event.title,
    date: start
      ? `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
      : "",
    time: start ? clock(start) : "",
    endTime: end ? clock(end) : "",
    location: event.location ?? "",
    description: event.description ?? "",
    notes: event.notes ?? "",
    registrationUrl: event.registration_url ?? "",
    links,
    coverImageUrl: event.cover_image_url ?? "",
    categories: event.categories?.length
      ? event.categories
      : event.category
        ? [event.category]
        : [],
    activityType: event.activity_type ?? "",
    capacity: event.capacity != null ? String(event.capacity) : "",
    // Editing touches one occurrence; changing how often it repeats means
    // rebuilding the series, which isn't an edit.
    frequency: "once",
    occurrenceCount: "",
    repeatForever: false,
    pricingModel: event.pricing_model ?? "free",
    priceAmount: dollarsFrom(event.price_cents),
    priceGroupSize:
      event.price_group_size != null ? String(event.price_group_size) : "",
    priceSessions:
      event.price_sessions != null ? String(event.price_sessions) : "",
    priceNote: event.price_note ?? "",
    minAge: event.min_age != null ? String(event.min_age) : "",
    maxAge: event.max_age != null ? String(event.max_age) : "",
    requiresSignup: event.requires_signup,
    isVirtual: event.is_virtual ?? false,
    isYouth: event.is_youth ?? false,
    // Derived ones are rebuilt on save from the answers that own them.
    accessibilityTags: (event.accessibility_tags ?? []).filter(
      (t) => !isDerivedTag(t),
    ),
  };
}

/** What the API wants, from what the form holds. */
export function payloadFrom(v: EventFormValues) {
  const priceTemplate = templateFor(v.pricingModel);
  const at = (time: string) =>
    v.date && time ? new Date(`${v.date}T${time}`).toISOString() : null;
  // What the host ticked, plus the two that are answered elsewhere on this
  // form. Deduped because an event edited before those answers owned the tags
  // may already carry one.
  const accessibility_tags = Array.from(
    new Set([
      ...v.accessibilityTags,
      ...(v.pricingModel === "free" ? ["free"] : []),
      ...(v.requiresSignup ? [] : ["no_registration"]),
    ]),
  );
  const registrationUrl = v.requiresSignup ? v.registrationUrl.trim() : "";
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    notes: v.notes.trim() || null,
    categories: v.categories,
    activity_type: v.activityType || null,
    location: v.location.trim() || null,
    starts_at: at(v.time),
    ends_at: at(v.endTime),
    cover_image_url: v.coverImageUrl || null,
    is_virtual: v.isVirtual,
    is_youth: v.isYouth,
    requires_signup: v.requiresSignup,
    // A sign-up link is what makes registration external.
    registration_mode: registrationUrl ? "external" : "internal",
    registration_url: registrationUrl || null,
    links: v.links
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.label || l.url),
    accessibility_tags,
    frequency: v.frequency,
    occurrence_count:
      v.repeatForever || !v.occurrenceCount.trim()
        ? null
        : Number(v.occurrenceCount),
    repeat_forever: v.frequency !== "once" && v.repeatForever,
    pricing_model: v.pricingModel,
    // Only the parts the chosen shape actually has. The form keeps whatever was
    // typed against the other shapes so switching back and forth loses nothing,
    // but sending those along would file a group size on a per-session price.
    price_cents: priceTemplate.needsAmount ? centsFrom(v.priceAmount) : null,
    price_group_size:
      priceTemplate.needsGroup && v.priceGroupSize.trim()
        ? Number(v.priceGroupSize)
        : null,
    price_sessions:
      priceTemplate.needsSessions && v.priceSessions.trim()
        ? Number(v.priceSessions)
        : null,
    price_note:
      v.pricingModel === "custom" ? v.priceNote.trim() || null : null,
    // Free is a consequence of the pricing model, not a separate answer.
    is_free: v.pricingModel === "free",
    // Blank means "no limit" and "any age", which is not the same as zero.
    capacity: v.capacity.trim() ? Number(v.capacity) : null,
    min_age: v.minAge.trim() ? Number(v.minAge) : null,
    max_age: v.maxAge.trim() ? Number(v.maxAge) : null,
  };
}

/** Everything marked with a * on the form, plus what can't be sent as typed. */
export function missingRequired(v: EventFormValues): string[] {
  const missing: string[] = [];
  if (!v.title.trim()) missing.push("name");
  if (!v.date) missing.push("date");
  if (!v.time) missing.push("start time");
  if (v.endTime && v.time && v.endTime <= v.time)
    missing.push("an end time after the start");
  if (!v.location.trim()) missing.push("location");
  if (!v.description.trim()) missing.push("description");
  if (v.description.length > DESCRIPTION_MAX)
    missing.push(`a description under ${DESCRIPTION_MAX} characters`);
  if (!v.coverImageUrl) missing.push("image");
  if (v.categories.length === 0) missing.push("activity type");
  if (v.links.some((l) => !!l.label.trim() !== !!l.url.trim()))
    missing.push("both a label and an address for each link");
  if (v.links.some((l) => checkPostingLink(l.url)?.tone === "error"))
    missing.push("a valid web address for each link");
  const t = templateFor(v.pricingModel);
  if (t.needsAmount && !centsFrom(v.priceAmount)) missing.push("price");
  if (t.needsGroup && !v.priceGroupSize.trim()) missing.push("group size");
  if (t.needsSessions && !v.priceSessions.trim()) missing.push("sessions");
  if (v.pricingModel === "custom" && !v.priceNote.trim())
    missing.push("cost description");
  if (v.frequency !== "once" && !v.repeatForever && !v.occurrenceCount.trim())
    missing.push("how many times it repeats");
  return missing;
}

/* ---------------- pieces ---------------- */

// The same box TextField draws, for the controls it doesn't wrap.
const controlClass =
  "min-h-12 w-full rounded-field border border-line bg-surface px-4 py-3 text-lg text-fg placeholder:text-fg-muted";

function Labelled({
  label,
  required,
  aside,
  children,
}: {
  label: string;
  required?: boolean;
  /** Sits at the right of the label line — the character counter. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-end justify-between gap-3 text-lg font-medium text-fg">
        <span>
          {label}
          {required && (
            <>
              <span aria-hidden="true" className="ml-1 text-danger-fg">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          )}
        </span>
        {aside}
      </span>
      {children}
    </label>
  );
}

function Section({
  title,
  lead,
  required,
  children,
}: {
  title: string;
  lead?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-lg font-medium text-fg">
        {title}
        {required && (
          <>
            <span aria-hidden="true" className="ml-1 text-danger-fg">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </legend>
      {lead && <p className="text-base text-fg-muted">{lead}</p>}
      {children}
    </fieldset>
  );
}

/** A multi-select chip. Leaving one unticked means "not saying", never "no". */
function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-control border px-4 py-2 text-lg text-fg transition-colors ${
        on
          ? "border-primary-border bg-primary-soft"
          : "border-line bg-surface hover:bg-surface-subtle"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------------- the form ---------------- */

export function EventForm({
  id,
  mode,
  values,
  onChange,
  submitting,
  onSubmit,
  error,
}: {
  /** The page's submit button points at this with `form={id}`. */
  id: string;
  /** Repeats are chosen when a program is created; editing touches one date. */
  mode: "create" | "edit";
  values: EventFormValues;
  onChange: (next: EventFormValues) => void;
  submitting: boolean;
  onSubmit: () => void;
  error: string | null;
}) {
  const [showMissing, setShowMissing] = useState(false);
  const missing = missingRequired(values);
  const set = <K extends keyof EventFormValues>(
    key: K,
    v: EventFormValues[K],
  ) => onChange({ ...values, [key]: v });
  const setLink = (i: number, patch: Partial<EventLink>) =>
    set(
      "links",
      values.links.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    );

  const paid = values.pricingModel !== "free";
  const priceTemplate = templateFor(values.pricingModel);
  const signupHint = values.requiresSignup
    ? checkPostingLink(values.registrationUrl)
    : null;

  return (
    <form
      id={id}
      className="flex flex-col gap-10"
      onSubmit={(e) => {
        e.preventDefault();
        if (missing.length) {
          setShowMissing(true);
          document.getElementById(`${id}-missing`)?.scrollIntoView({
            block: "center",
          });
          return;
        }
        if (!submitting) onSubmit();
      }}
    >
      <div id={`${id}-missing`} className="flex flex-col gap-2">
        <p className="text-base text-fg-muted">
          Mandatory fields are marked with{" "}
          <span className="text-danger-fg">*</span>.
        </p>
        {showMissing && missing.length > 0 && (
          <p role="alert" className="text-lg font-medium text-danger-fg">
            Still needed: {missing.join(", ")}.
          </p>
        )}
        {error && (
          <p role="alert" className="text-lg font-medium text-danger-fg">
            {error}
          </p>
        )}
      </div>

      <div className="grid gap-x-9 gap-y-6 lg:grid-cols-[598px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Section title="Event image" required>
            <ImageDrop
              label="Event image"
              value={values.coverImageUrl}
              onChange={(v) => set("coverImageUrl", v)}
            />
          </Section>

          <TextField
            label="Name of Event"
            required
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Open Space: Coffee & Chats"
            autoComplete="off"
          />

          <TextField
            label="Date"
            required
            type="date"
            value={values.date}
            // Chrome's date field takes a six-digit year; min/max bound the
            // spinner and the clamp catches typing.
            min="2000-01-01"
            max="2100-12-31"
            onChange={(e) => {
              const v = e.target.value;
              if (v && (v.length > 10 || Number(v.slice(0, 4)) > 2100)) return;
              set("date", v);
            }}
          />

          <div className="flex flex-col gap-1">
            <p className="text-lg font-medium text-fg">
              Time
              <span aria-hidden="true" className="ml-1 text-danger-fg">
                *
              </span>
            </p>
            <div className="flex items-center gap-2">
              <TextField
                label="Start time"
                className="flex-1 [&>label]:sr-only"
                type="time"
                required
                value={values.time}
                onChange={(e) => set("time", e.target.value)}
              />
              <span aria-hidden="true" className="h-px w-[30px] bg-fg-icon" />
              <TextField
                label="End time"
                className="flex-1 [&>label]:sr-only"
                type="time"
                value={values.endTime}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </div>
          </div>

          <TextField
            label="Location"
            required
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Enter location here"
          />
        </div>

        <div className="flex flex-col gap-6">
          <Labelled
            label={`Brief Description (Max ${DESCRIPTION_MAX} Characters)`}
            required
            aside={
              <span
                className={`text-base ${
                  values.description.length >= DESCRIPTION_MAX
                    ? "text-danger-fg"
                    : "text-fg-muted"
                }`}
                aria-live="polite"
              >
                {values.description.length}/{DESCRIPTION_MAX}
              </span>
            }
          >
            <textarea
              rows={6}
              maxLength={DESCRIPTION_MAX}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              className={`${controlClass} resize-y`}
              placeholder="Type out your description here…"
            />
          </Labelled>

          <Section
            title="Important Links"
            lead="A flyer, a map, your own page — up to three. Each needs a short label and the address."
          >
            <div className="flex flex-col gap-3">
              {values.links.map((link, i) => (
                <div
                  key={i}
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
                >
                  <TextField
                    label={`Link ${i + 1} label`}
                    className="[&>label]:sr-only"
                    value={link.label}
                    onChange={(e) => setLink(i, { label: e.target.value })}
                    placeholder={`Link ${i + 1} label`}
                  />
                  <TextField
                    label={`Link ${i + 1} address`}
                    className="[&>label]:sr-only"
                    // type="text": the browser's url validation rejects
                    // "yourorg.ca"; the API adds https:// when it's missing.
                    type="text"
                    inputMode="url"
                    value={link.url}
                    onChange={(e) => setLink(i, { url: e.target.value })}
                    placeholder={`Link ${i + 1} address`}
                    error={
                      checkPostingLink(link.url)?.tone === "error"
                        ? "That doesn't look like a web address."
                        : null
                    }
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Event Tags">
            <div className="flex flex-col items-start gap-4">
              <SegmentedToggle<"free" | "paid">
                label="Cost"
                value={paid ? "paid" : "free"}
                onChange={(v) =>
                  // Coming back to paid lands on the commonest shape.
                  set("pricingModel", v === "free" ? "free" : "per_session")
                }
                segments={[
                  { value: "free", label: "Free" },
                  { value: "paid", label: "Paid" },
                ]}
              />
              <SegmentedToggle<"dropin" | "registration">
                label="Registration"
                value={values.requiresSignup ? "registration" : "dropin"}
                onChange={(v) => set("requiresSignup", v === "registration")}
                segments={[
                  { value: "dropin", label: "Drop-in" },
                  { value: "registration", label: "Registration" },
                ]}
              />
              <SegmentedToggle<"virtual" | "inperson">
                label="Venue"
                value={values.isVirtual ? "virtual" : "inperson"}
                onChange={(v) => set("isVirtual", v === "virtual")}
                segments={[
                  { value: "virtual", label: "Virtual" },
                  { value: "inperson", label: "In-Person" },
                ]}
              />
            </div>
          </Section>

          {paid && (
            <Section title="How is it paid?" required>
              <div className="flex flex-col gap-2">
                {PAID_MODELS.map((m) => {
                  const t = templateFor(m);
                  const on = values.pricingModel === m;
                  return (
                    <label
                      key={m}
                      className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 ${
                        on
                          ? "border-primary-border bg-primary-soft"
                          : "border-line hover:bg-surface-subtle"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${id}-pricing`}
                        checked={on}
                        onChange={() => set("pricingModel", m)}
                        className="mt-1.5 size-4 accent-primary-border"
                      />
                      <span>
                        <span className="block text-lg text-fg">{t.label}</span>
                        <span className="block text-base text-fg-muted">
                          {t.hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4">
                {priceTemplate.needsAmount && (
                  <TextField
                    label="Price"
                    required
                    className="min-w-[150px]"
                    inputMode="decimal"
                    value={values.priceAmount}
                    onChange={(e) => set("priceAmount", e.target.value)}
                    placeholder="$12.50"
                  />
                )}
                {priceTemplate.needsGroup && (
                  <TextField
                    label="People it covers"
                    required
                    className="min-w-[180px]"
                    type="number"
                    min={2}
                    value={values.priceGroupSize}
                    onChange={(e) => set("priceGroupSize", e.target.value)}
                    placeholder="4"
                  />
                )}
                {priceTemplate.needsSessions && (
                  <TextField
                    label="Dates it covers"
                    required
                    className="min-w-[180px]"
                    type="number"
                    min={2}
                    value={values.priceSessions}
                    onChange={(e) => set("priceSessions", e.target.value)}
                    placeholder="8"
                  />
                )}
                {values.pricingModel === "custom" && (
                  <TextField
                    label="Describe the cost"
                    required
                    className="min-w-[280px] flex-1"
                    value={values.priceNote}
                    onChange={(e) => set("priceNote", e.target.value)}
                    placeholder="$5 suggested, pay what you can"
                  />
                )}
              </div>
              {values.pricingModel === "series" && (
                <p className="text-base text-fg-muted">
                  Signing up once enrols the member in every date in this series.
                </p>
              )}
            </Section>
          )}

          {values.requiresSignup && (
            <div className="flex flex-col gap-2">
              <TextField
                label="Sign-up link"
                type="text"
                inputMode="url"
                value={values.registrationUrl}
                onChange={(e) => set("registrationUrl", e.target.value)}
                placeholder="yourorg.ca/register"
                error={
                  signupHint?.tone === "error" ? signupHint.message : null
                }
              />
              {/* A caution, not a refusal: some agencies really do have one
                  page, and blocking that gets the link left out entirely. */}
              <p
                role="status"
                className={`text-base ${
                  signupHint?.tone === "warn"
                    ? "rounded-control bg-tag-dropin-bg px-3 py-2 text-tag-dropin-fg"
                    : "text-fg-muted"
                }`}
              >
                {signupHint?.tone === "warn"
                  ? signupHint.message
                  : "Where people register on your own site. Leave it blank if they sign up here instead."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Not on the mockup, but the member feed sorts and filters on these —
          a program without a topic can't match anyone. */}
      <div className="flex flex-col gap-8 border-t border-line pt-8">
        <h2 className="text-2xl font-medium text-fg">More details</h2>

        <Section
          title="Activity Type"
          required
          lead="Members pick these same topics as interests — this is what puts your event in front of the right people. Choose as many as fit."
        >
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = values.categories.includes(c.label);
              return (
                <Chip
                  key={c.label}
                  on={on}
                  onClick={() =>
                    set(
                      "categories",
                      on
                        ? values.categories.filter((x) => x !== c.label)
                        : [...values.categories, c.label],
                    )
                  }
                >
                  <span aria-hidden="true">{c.emoji}</span> {c.label}
                </Chip>
              );
            })}
          </div>
        </Section>

        {mode === "create" && (
          <Section title="Does it repeat?">
            <div className="flex flex-wrap items-end gap-4">
              <Labelled label="How often">
                <select
                  value={values.frequency}
                  onChange={(e) => set("frequency", e.target.value as Frequency)}
                  className={`${controlClass} min-w-[200px]`}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Labelled>
              {values.frequency !== "once" && !values.repeatForever && (
                <TextField
                  label="How many times"
                  required
                  className="min-w-[170px]"
                  type="number"
                  min={2}
                  max={104}
                  value={values.occurrenceCount}
                  onChange={(e) => set("occurrenceCount", e.target.value)}
                  placeholder="8"
                />
              )}
              {values.frequency !== "once" && (
                // A drop-in that has run every Friday for nine years has no
                // session count to give.
                <label className="flex min-h-12 cursor-pointer items-center gap-3 text-lg text-fg">
                  <input
                    type="checkbox"
                    checked={values.repeatForever}
                    onChange={(e) => set("repeatForever", e.target.checked)}
                    className="size-5 accent-primary-border"
                  />
                  It keeps going
                </label>
              )}
            </div>
            {values.frequency !== "once" && (
              <p className="text-base text-fg-muted">
                Each date is posted separately, so people can save the ones they
                can make.
                {values.repeatForever &&
                  " We'll post about two years ahead and extend it from there."}
              </p>
            )}
          </Section>
        )}

        <div className="flex flex-wrap gap-4">
          <TextField
            label="Spaces (blank for no limit)"
            className="min-w-[220px] flex-1"
            type="number"
            min={1}
            value={values.capacity}
            onChange={(e) => set("capacity", e.target.value)}
            placeholder="20"
          />
          <TextField
            label="Youngest age"
            className="min-w-[140px]"
            type="number"
            min={0}
            value={values.minAge}
            onChange={(e) => set("minAge", e.target.value)}
            placeholder="Any"
          />
          <TextField
            label="Oldest age"
            className="min-w-[140px]"
            type="number"
            min={0}
            value={values.maxAge}
            onChange={(e) => set("maxAge", e.target.value)}
            placeholder="Any"
          />
        </div>

        <Labelled label="Extra details">
          <textarea
            rows={3}
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            className={`${controlClass} resize-y`}
            placeholder="What to bring, who to ask for, anything that varies week to week."
          />
        </Labelled>

        <Section title="Who is it for?">
          <SegmentedToggle<"youth" | "everyone">
            className="self-start"
            label="Audience"
            value={values.isYouth ? "youth" : "everyone"}
            onChange={(v) => set("isYouth", v === "youth")}
            segments={[
              { value: "everyone", label: "Everyone" },
              { value: "youth", label: "Youth" },
            ]}
          />
        </Section>

        <Section
          title="What does it offer?"
          lead="Tick only what you can vouch for. Anything left unticked just means you haven't said."
        >
          <div className="flex flex-wrap gap-2">
            {SELECTABLE_TAGS.map(({ slug, label, emoji }) => {
              const on = values.accessibilityTags.includes(slug);
              return (
                <Chip
                  key={slug}
                  on={on}
                  onClick={() =>
                    set(
                      "accessibilityTags",
                      on
                        ? values.accessibilityTags.filter((t) => t !== slug)
                        : [...values.accessibilityTags, slug],
                    )
                  }
                >
                  <span aria-hidden="true">{emoji}</span> {label}
                </Chip>
              );
            })}
          </div>
        </Section>
      </div>
    </form>
  );
}
