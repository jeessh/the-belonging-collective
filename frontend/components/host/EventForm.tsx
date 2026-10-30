"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  Upload,
} from "lucide-react";
import type { Event, EventLink } from "@/lib/api";
import { ImageDrop } from "@/components/ImageDrop";
import { Field, RequiredMark, Select, TextArea } from "@/components/AdminTable";
import { Checkbox } from "@/components/ui/Checkbox";
import { FilterChip } from "@/components/ui/FilterChip";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/Modal";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { AccessPicker, type AccessMode } from "@/components/host/AccessPicker";
import { PosterField } from "@/components/host/PosterField";
import { checkPostingLink } from "@/lib/postingLink";
import { categoryStyle } from "@/lib/categories";
import { useCategories } from "@/lib/useCategories";
import { SELECTABLE_TAGS, isDerivedTag } from "@/lib/accessibility";
import {
  PAID_MODELS,
  centsFrom,
  dollarsFrom,
  templateFor,
  type PricingModel,
} from "@/lib/pricing";
import { FREQUENCIES, type Frequency } from "@/lib/recurrence";
import { Glyph } from "@/components/ui/Glyph";
import { PageHeader } from "@/components/host/PageHeader";

/** A location that is a meeting app or plainly online, not a place. */
const ONLINE_PLACE = /\b(online|virtual|zoom|teams|google meet|meet\.google|webex|skype)\b/i;

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
  /** The agency's own flyer (PDF or image URL), "" for none. */
  posterUrl: string;
  /**
   * Who can see it. `group` needs `accessGroupId`; the two are separate so
   * switching to special access before picking a group is a visible,
   * unsaveable state rather than a silent "everyone".
   */
  accessMode: AccessMode;
  accessGroupId: string | null;
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
  posterUrl: "",
  accessMode: "everyone",
  accessGroupId: null,
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
    posterUrl: event.poster_url ?? "",
    accessMode: event.access_group_id ? "group" : "everyone",
    accessGroupId: event.access_group_id ?? null,
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
  const registrationUrl = v.registrationUrl.trim();
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
    poster_url: v.posterUrl || null,
    // Explicit null makes it public again; the PATCH treats "unset" as
    // "leave alone".
    access_group_id: v.accessMode === "group" ? v.accessGroupId : null,
  };
}

/** One thing stopping a save: the field it belongs to (for that field's own
    error), the phrase for the "Still needed" summary, and the field message. */
export type Problem = { field: string; text: string; error: string };

const WHOLE = /^\d+$/;

/** Everything marked with a * on the form, plus what can't be sent as typed. */
export function missingRequired(
  v: EventFormValues,
  mode: "create" | "edit",
): Problem[] {
  const out: Problem[] = [];
  const need = (field: string, text: string, error = "This is required.") =>
    out.push({ field, text, error });
  if (!v.title.trim()) need("title", "name");
  if (!v.date) need("date", "date");
  if (!v.time) need("time", "start time");
  if (v.endTime && v.time && v.endTime <= v.time)
    need("endTime", "an end time after the start", "End after the start time.");
  // A virtual program happens online; there is no place to give.
  if (!v.isVirtual && !v.location.trim()) need("location", "location");
  if (!v.description.trim()) need("description", "description");
  if (v.description.length > DESCRIPTION_MAX)
    need("description", `a description under ${DESCRIPTION_MAX} characters`);
  // Only new programs: older ones were posted before an image was required,
  // and refusing every edit to them until one is found helps nobody.
  if (mode === "create" && !v.coverImageUrl) need("coverImageUrl", "image");
  if (v.categories.length === 0) need("categories", "a topic");
  if (v.links.some((l) => !!l.label.trim() !== !!l.url.trim()))
    need("links", "both a label and an address for each link");
  if (v.links.some((l) => checkPostingLink(l.url)?.tone === "error"))
    need("links", "a valid web address for each link");
  const t = templateFor(v.pricingModel);
  if (t.needsAmount && !centsFrom(v.priceAmount)) need("priceAmount", "price");
  if (t.needsGroup && !v.priceGroupSize.trim())
    need("priceGroupSize", "group size");
  if (t.needsSessions && !v.priceSessions.trim())
    need("priceSessions", "sessions");
  if (v.pricingModel === "custom" && !v.priceNote.trim())
    need("priceNote", "cost description");
  if (v.frequency !== "once" && !v.repeatForever && !v.occurrenceCount.trim())
    need("occurrenceCount", "how many times it repeats");
  if (v.accessMode === "group" && !v.accessGroupId)
    need("accessGroupId", "which group can see it");
  // Blank is fine (no limit, any age); what's typed has to make sense.
  const capacity = v.capacity.trim();
  if (capacity && (!WHOLE.test(capacity) || Number(capacity) < 1))
    need("capacity", "spaces as a whole number of at least 1", "Use a whole number of at least 1.");
  const minAge = v.minAge.trim();
  const maxAge = v.maxAge.trim();
  if (minAge && !WHOLE.test(minAge))
    need("minAge", "the youngest age as a whole number", "Use a whole number.");
  if (maxAge && !WHOLE.test(maxAge))
    need("maxAge", "the oldest age as a whole number", "Use a whole number.");
  if (WHOLE.test(minAge) && WHOLE.test(maxAge) && Number(minAge) > Number(maxAge))
    need(
      "maxAge",
      "an oldest age no younger than the youngest",
      "Can't be younger than the youngest age.",
    );
  return out;
}

/**
 * Unsaved-changes protection for the event form: the browser's own warning
 * on reload or close, and a "Leave without saving?" dialog for any link that
 * would leave the page — the page's back arrow (pass `onBack` to PageHeader)
 * and every other link on it: the side panel, the logo, the account menu.
 * Render `dialog` somewhere.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older browsers only warn when this is set.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    // Client-side navigation never fires beforeunload, so catch the click on
    // the way down, before Next's Link handles it. Links that open a new tab
    // (or are opened that way) leave the form where it is, so they pass.
    const intercept = (e: globalThis.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.target === "_blank" || a.hasAttribute("download"))
        return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin) return;
      if (to.pathname === window.location.pathname && to.search === window.location.search)
        return;
      e.preventDefault();
      e.stopPropagation();
      setLeaving(to.pathname + to.search + to.hash);
    };
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty]);

  const onBack = (e: MouseEvent<HTMLElement>) => {
    if (!dirty) return;
    e.preventDefault();
    setLeaving(e.currentTarget.getAttribute("href"));
  };

  const dialog = leaving && (
    <Modal
      title="Leave without saving?"
      subtitle="Your changes to this event will be lost."
      onClose={() => setLeaving(null)}
    >
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => setLeaving(null)}>
          Keep editing
        </Button>
        <Button onClick={() => router.push(leaving)}>Leave</Button>
      </div>
    </Modal>
  );

  return { onBack, dialog };
}

/* ---------------- pieces ---------------- */

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    // min-w-0: a fieldset is min-content wide by default, which pushed the
    // form past a phone's width.
    <fieldset className="field flex min-w-0 flex-col gap-3">
      <legend className="field-label text-lg font-medium text-fg">
        {title}
        {required && <RequiredMark />}
      </legend>
      {children}
    </fieldset>
  );
}

/** One titled part of the form (and of the details page, which mirrors it):
    a heading over its fields, a faint rule above. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    // A faint rule between groups: it separates without competing with the
    // fields.
    <section className="flex min-w-0 flex-col gap-4 border-t border-line/40 pt-5 first:border-t-0 first:pt-0">
      <h2 className="group-heading text-xl font-medium text-fg">{title}</h2>
      {children}
    </section>
  );
}

/* ---------------- the form ---------------- */

export function EventForm({
  id,
  mode,
  hostId,
  inSeries = false,
  values,
  onChange,
  submitting,
  onSubmit,
  error,
  submitLabel,
  submittingLabel,
  imageFallback,
  header,
}: {
  /** The page's submit button points at this with `form={id}`. */
  id: string;
  /** Repeats are chosen when a program is created; editing touches one date. */
  mode: "create" | "edit";
  /** The organization the program belongs to — whose access groups apply. */
  hostId: string;
  /** Editing one date of a repeating program — the form says what an edit reaches. */
  inSeries?: boolean;
  values: EventFormValues;
  /**
   * Takes an updater, never a whole object: an upload finishing hands its URL
   * to a callback made before the upload began, and building from that
   * render's `values` wiped whatever was typed while it ran.
   */
  onChange: (update: (prev: EventFormValues) => EventFormValues) => void;
  submitting: boolean;
  onSubmit: () => void;
  error: string | null;
  /** The submit button's words: "Publish Event" / "Save Edits". */
  submitLabel: string;
  submittingLabel: string;
  /**
   * Editing: the picture the event shows members now when it has no cover
   * of its own (another of its images, or the stock photo for its topic).
   */
  imageFallback?: string;
  /**
   * The page header the form draws: its title is the event's name, editable
   * right there (so the name has no box of its own in the form); the page
   * supplies the back link, the line under the title and the buttons, which
   * sit on their own line below.
   */
  header: {
    backHref: string;
    backLabel?: string;
    onBack?: (e: MouseEvent<HTMLElement>) => void;
    subtitle?: ReactNode;
    actions?: ReactNode;
  };
}) {
  const [showMissing, setShowMissing] = useState(false);
  const { categories } = useCategories();
  const problems = missingRequired(values, mode);
  const missing = problems.map((p) => p.text);
  /** A field's own message, once the summary is showing. */
  const fieldError = (field: string) =>
    showMissing
      ? (problems.find((p) => p.field === field)?.error ?? null)
      : null;
  const set = <K extends keyof EventFormValues>(
    key: K,
    v: EventFormValues[K],
  ) => onChange((prev) => ({ ...prev, [key]: v }));
  // Venue and location answer the same question, so each nudges the other:
  // choosing Virtual with no location fills in "Online" (and choosing
  // In-Person clears that again), and typing a meeting app or "online"
  // switches the venue to Virtual. An address can't be told apart reliably,
  // so typing one never flips it back.
  const setVenue = (virtual: boolean) => {
    onChange((prev) => {
      const loc = prev.location.trim();
      return {
        ...prev,
        isVirtual: virtual,
        location:
          virtual && loc === ""
            ? "Online"
            : !virtual && loc === "Online"
              ? ""
              : prev.location,
      };
    });
  };
  const setLocation = (text: string) =>
    onChange((prev) => ({
      ...prev,
      location: text,
      isVirtual: prev.isVirtual || ONLINE_PLACE.test(text),
    }));
  const setLink = (i: number, patch: Partial<EventLink>) =>
    onChange((prev) => ({
      ...prev,
      links: prev.links.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    }));
  const toggle = (key: "categories" | "accessibilityTags", slug: string) =>
    onChange((prev) => ({
      ...prev,
      [key]: prev[key].includes(slug)
        ? prev[key].filter((x) => x !== slug)
        : [...prev[key], slug],
    }));

  const paid = values.pricingModel !== "free";
  const priceTemplate = templateFor(values.pricingModel);
  const signupHint = values.requiresSignup
    ? checkPostingLink(values.registrationUrl)
    : null;

  const summaryRef = useRef<HTMLDivElement>(null);

  return (
    <form
      id={id}
      className="form-dense flex flex-col gap-5"
      // The summary and each field's own message say what's wrong; the
      // browser's bubbles arrived first and said it differently.
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (problems.length) {
          setShowMissing(true);
          // The summary names everything still needed; take people to it.
          requestAnimationFrame(() => {
            summaryRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
            summaryRef.current?.focus({ preventScroll: true });
          });
          return;
        }
        if (!submitting) onSubmit();
      }}
    >
      <div className="mb-4">
        <PageHeader
          backHref={header.backHref}
          backLabel={header.backLabel}
          onBack={header.onBack}
          subtitle={header.subtitle}
          actions={header.actions}
          actionsBelow
          title={
            <div className="flex flex-col gap-1">
              <h1 className="sr-only">
                {mode === "create" ? "Create New Event" : "Edit Event Details"}
              </h1>
              {/* The event's name is the page title, and it's typed right
                  here: it reads as a heading, and shows it's editable on
                  hover and focus. */}
              <span className="flex items-center gap-2">
                <input
                  aria-label="Name of Event"
                  aria-required="true"
                  aria-invalid={fieldError("title") ? true : undefined}
                  aria-describedby={fieldError("title") ? `${id}-title-error` : undefined}
                  value={values.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Name of Event"
                  autoComplete="off"
                  className={`event-title -ml-2 min-w-0 flex-1 rounded-control border bg-transparent px-2 py-1 font-medium text-fg placeholder:text-fg-muted hover:border-line focus:border-line focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6] ${
                    fieldError("title") ? "border-danger-border" : "border-transparent"
                  }`}
                />
                <Pencil aria-hidden="true" className="size-5 shrink-0 text-fg-icon-muted" />
              </span>
              {fieldError("title") && (
                <p id={`${id}-title-error`} className="text-base text-danger-fg">
                  {fieldError("title")}
                </p>
              )}
            </div>
          }
        />
      </div>

      <div
        id={`${id}-missing`}
        ref={summaryRef}
        tabIndex={-1}
        className="flex flex-col gap-2 outline-none"
      >
        {inSeries && (
          <p className="text-base text-fg-muted">
            Changes apply to this date and every later date in the series. The
            date and time change for this date only.
          </p>
        )}
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

      {/* Two columns from lg: the event itself and when it is on the left,
          everything that describes it on the right. One column, in that
          order, below lg. */}
      <div className="grid max-w-[1200px] items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <h2 className="group-heading text-xl font-medium text-fg">Event details</h2>
          <Section title="Event image" required={mode === "create"}>
            <ImageDrop
              compact
              square
              fallback={imageFallback}
              label="Event image"
              value={values.coverImageUrl}
              onChange={(v) => set("coverImageUrl", v)}
            />
          </Section>
          <TextField
            label="Date"
            placeholder="DD/MM/YYYY"
            required
            type="date"
            icon={<CalendarDays />}
            value={values.date}
            error={fieldError("date")}
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
          <div className="field flex flex-col gap-2">
            <p className="field-label text-lg font-medium text-fg">
              Time
              <RequiredMark />
            </p>
            <div className="flex items-start gap-2">
              <TextField
                label="Start time"
                placeholder="9:00 AM"
                className="min-w-0 flex-1 [&>label]:sr-only"
                type="time"
                icon={<Clock />}
                required
                value={values.time}
                error={fieldError("time")}
                onChange={(e) => set("time", e.target.value)}
              />
              {/* Centred on the boxes (36px), whatever errors show under them. */}
              <span aria-hidden="true" className="flex h-9 shrink-0 items-center">
                <span className="h-px w-3 bg-fg-icon-muted" />
              </span>
              <TextField
                label="End time"
                placeholder="11:00 AM"
                className="min-w-0 flex-1 [&>label]:sr-only"
                type="time"
                icon={<Clock />}
                value={values.endTime}
                error={fieldError("endTime")}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </div>
          </div>
          <Section title="Where">
            <div className="flex flex-col items-start gap-4">
              <SegmentedToggle<"virtual" | "inperson">
                size="sm"
                label="Venue"
                value={values.isVirtual ? "virtual" : "inperson"}
                onChange={(v) => setVenue(v === "virtual")}
                segments={[
                  { value: "virtual", label: "Virtual" },
                  { value: "inperson", label: "In-Person" },
                ]}
              />
            </div>
          </Section>
          <TextField
            label={values.isVirtual ? "Location (online)" : "Location"}
            required={!values.isVirtual}
            icon={<MapPin />}
            value={values.location}
            error={fieldError("location")}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={
              values.isVirtual
                ? "e.g. Zoom — link sent after sign-up"
                : "Street address or building"
            }
          />
          {mode === "create" && (
            <Section title="Repeats">
              <div className="flex flex-wrap items-end gap-4">
                {/* The section's "Repeats" is its label; no second one. */}
                <Select
                  aria-label="Repeats"
                  className="min-w-[200px]"
                  value={values.frequency}
                  onChange={(e) => set("frequency", e.target.value as Frequency)}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
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
                    error={fieldError("occurrenceCount")}
                    placeholder="8"
                  />
                )}
                {values.frequency !== "once" && (
                  // A drop-in that has run every Friday for nine years has no
                  // session count to give.
                  <Checkbox
                    label="It keeps going"
                    className="min-h-12"
                    checked={values.repeatForever}
                    onChange={(e) => set("repeatForever", e.target.checked)}
                  />
                )}
              </div>
            </Section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Group title="Description">
            <Field
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
              <TextArea
                rows={3}
                maxLength={DESCRIPTION_MAX}
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Type out your description here…"
              />
            </Field>
          </Group>
          <Group title="Cost & sign-up">
            <Section title="Cost">
              <div className="flex flex-col items-start gap-4">
                <SegmentedToggle<"free" | "paid">
                  size="sm"
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
              </div>
            </Section>
            {paid && (
              <Section title="How is it paid?" required>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PAID_MODELS.map((m) => {
                    const t = templateFor(m);
                    const on = values.pricingModel === m;
                    return (
                      <label
                        key={m}
                        className={`flex cursor-pointer items-center gap-3 rounded-control border px-3 py-2 ${
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
                          className="size-4 accent-primary-border"
                        />
                        <span className="text-lg text-fg">{t.label}</span>
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
                      error={fieldError("priceAmount")}
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
                      error={fieldError("priceGroupSize")}
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
                      error={fieldError("priceSessions")}
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
                      error={fieldError("priceNote")}
                      placeholder="$5 suggested, pay what you can"
                    />
                  )}
                </div>
              </Section>
            )}
            <Section title="How people join">
              <div className="flex flex-col items-start gap-4">
                <SegmentedToggle<"dropin" | "registration">
                  size="sm"
                  label="Registration"
                  value={values.requiresSignup ? "registration" : "dropin"}
                  onChange={(v) => set("requiresSignup", v === "registration")}
                  segments={[
                    { value: "dropin", label: "Drop-in" },
                    { value: "registration", label: "Registration" },
                  ]}
                />
              </div>
            </Section>
            {/* Shown for drop-ins too: many carry a posting link, and hiding
                the field would blank it on the next save. */}
            <div className="flex flex-col gap-2">
              <TextField
                label={values.requiresSignup ? "Sign-up link" : "Posting link"}
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
                className={
                  signupHint?.tone === "warn"
                    ? "rounded-control bg-tag-dropin-bg px-3 py-2 text-base text-tag-dropin-fg"
                    : "sr-only"
                }
              >
                {signupHint?.tone === "warn" ? signupHint.message : ""}
              </p>
            </div>
          </Group>
          <Group title="Who it's for">
            <div className="flex flex-wrap gap-4">
              <TextField
                label="Spots available (blank for no limit)"
                className="min-w-[220px] flex-1"
                type="number"
                min={1}
                value={values.capacity}
                onChange={(e) => set("capacity", e.target.value)}
                error={fieldError("capacity")}
                placeholder="20"
              />
              <TextField
                label="Youngest age"
                className="min-w-[140px]"
                type="number"
                min={0}
                value={values.minAge}
                onChange={(e) => set("minAge", e.target.value)}
                error={fieldError("minAge")}
                placeholder="Any"
              />
              <TextField
                label="Oldest age"
                className="min-w-[140px]"
                type="number"
                min={0}
                value={values.maxAge}
                onChange={(e) => set("maxAge", e.target.value)}
                error={fieldError("maxAge")}
                placeholder="Any"
              />
            </div>
            <Section title="Who is it for?">
              <SegmentedToggle<"youth" | "everyone">
                size="sm"
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
            >
              <div className="flex flex-wrap gap-2">
                {SELECTABLE_TAGS.map(({ slug, label, icon }) => {
                  const on = values.accessibilityTags.includes(slug);
                  return (
                    <FilterChip
                      key={slug}
                      selected={on}
                      onClick={() => toggle("accessibilityTags", slug)}
                    >
                      <Glyph icon={icon} />
                      &nbsp;{label}
                    </FilterChip>
                  );
                })}
              </div>
            </Section>
            <Section
              title="Who can see this"
            >
              <AccessPicker
                hostId={hostId}
                mode={values.accessMode}
                groupId={values.accessGroupId}
                onChange={(accessMode, accessGroupId) =>
                  onChange((prev) => ({ ...prev, accessMode, accessGroupId }))
                }
              />
            </Section>
          </Group>
          <Group title="Topics">
            <Section
              title="Pick one or more"
              required
            >
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const on = values.categories.includes(c.slug);
                  return (
                    <FilterChip
                      key={c.slug}
                      selected={on}
                      onClick={() => toggle("categories", c.slug)}
                    >
                      <Glyph icon={categoryStyle(c.slug).icon} />
                      &nbsp;{c.label}
                    </FilterChip>
                  );
                })}
              </div>
            </Section>
          </Group>
          <Group title="Details & links">
            <Section
              title="Important Links"
            >
              <div className="flex flex-col gap-3">
                {values.links.map((link, i) => (
                  <div
                    key={i}
                    className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
                  >
                    {/* The placeholder says which box is the label: "Link 1"
                        read as "put link 1 here", so addresses ended up in it. */}
                    <TextField
                      label={`Link ${i + 1} label`}
                      className="[&>label]:sr-only"
                      value={link.label}
                      onChange={(e) => setLink(i, { label: e.target.value })}
                      placeholder="Link label, e.g. Flyer"
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
                      placeholder="Web address, e.g. yourorg.ca/page"
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
            <Field label="Extra details">
              <TextArea
                rows={3}
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="What to bring, who to ask for, anything that varies week to week."
              />
            </Field>
            <Section
              title="Printable poster"
            >
              <PosterField
                value={values.posterUrl}
                onChange={(v) => set("posterUrl", v)}
              />
            </Section>
          </Group>
        </div>
      </div>

      <div className="flex max-w-[1200px] flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="max-sm:w-full"
          disabled={submitting}
          trailingIcon={<Upload />}
        >
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
