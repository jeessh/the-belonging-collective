"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
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
import { SELECTABLE_TAGS, isDerivedTag, tagLabel } from "@/lib/accessibility";
import { longDate, timeRange } from "@/lib/time";
import {
  PAID_MODELS,
  centsFrom,
  dollarsFrom,
  templateFor,
  type PricingModel,
} from "@/lib/pricing";
import { FREQUENCIES, type Frequency } from "@/lib/recurrence";

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
  if (v.categories.length === 0) need("categories", "activity type");
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
 * on reload or close, and a "Leave without saving?" dialog for the page's
 * back arrow (pass `onBack` to PageHeader). Render `dialog` somewhere.
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
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onBack = (e: MouseEvent<HTMLAnchorElement>) => {
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
    // min-w-0: a fieldset is min-content wide by default, which pushed the
    // form past a phone's width.
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="text-lg font-medium text-fg">
        {title}
        {required && <RequiredMark />}
      </legend>
      {lead && <p className="text-base text-fg-muted">{lead}</p>}
      {children}
    </fieldset>
  );
}

/* ---------------- steps ---------------- */

/**
 * Creating an event, one step at a time: the essentials first, the optional
 * extras together near the end, then everything on one page to check before
 * it goes live. Editing uses the same steps, all open at once, with Save
 * available from any of them.
 */
export const STEPS = [
  { title: "The basics", optional: false },
  { title: "When & where", optional: false },
  { title: "Cost & sign-up", optional: false },
  { title: "Who it's for", optional: true },
  { title: "Details & links", optional: true },
  { title: "Review", optional: false },
] as const;

/** Which step a field lives on — where a "missing" problem sends you. */
const FIELD_STEP: Record<string, number> = {
  coverImageUrl: 0,
  title: 0,
  categories: 0,
  description: 0,
  date: 1,
  time: 1,
  endTime: 1,
  location: 1,
  occurrenceCount: 1,
  priceAmount: 2,
  priceGroupSize: 2,
  priceSessions: 2,
  priceNote: 2,
  capacity: 3,
  minAge: 3,
  maxAge: 3,
  accessGroupId: 3,
  links: 4,
};
const stepOfField = (field: string) => FIELD_STEP[field] ?? 0;

/**
 * The numbered steps across the top. A step can be opened once it has been
 * reached; on a phone the list scrolls sideways and the current step's name
 * is spelled out under it.
 */
function StepList({
  current,
  reached,
  done,
  onPick,
}: {
  current: number;
  reached: number;
  done: (i: number) => boolean;
  onPick: (i: number) => void;
}) {
  return (
    <nav aria-label="Event steps" className="flex flex-col gap-3">
      <ol className="flex gap-2 overflow-x-auto pb-1 sm:gap-3">
        {STEPS.map((s, i) => {
          const on = i === current;
          const open = i <= reached;
          const ok = done(i);
          return (
            <li key={s.title} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onPick(i)}
                disabled={!open}
                aria-current={on ? "step" : undefined}
                className={`flex w-full min-w-[3rem] flex-col gap-2 rounded-control border-t-4 px-1 pt-2 text-left transition-colors disabled:cursor-not-allowed ${
                  on
                    ? "border-primary-border"
                    : ok
                      ? "border-toast-success hover:bg-surface-subtle"
                      : open
                        ? "border-line hover:bg-surface-subtle"
                        : "border-line opacity-60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-base font-medium ${
                      on
                        ? "bg-primary text-fg"
                        : ok
                          ? "bg-tag-free-bg text-tag-free-fg"
                          : "bg-surface-subtle text-fg-muted"
                    }`}
                  >
                    {ok && !on ? <Check className="size-5" /> : i + 1}
                  </span>
                  <span
                    className={`truncate text-lg max-md:sr-only ${
                      on ? "font-medium text-fg" : "text-fg-muted"
                    }`}
                  >
                    {s.title}
                  </span>
                  {/* Read out in full where the visible name is hidden. */}
                  <span className="sr-only">
                    {ok ? ", done" : ""}
                    {!open ? ", not reached yet" : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-base text-fg-muted md:hidden" aria-hidden="true">
        Step {current + 1} of {STEPS.length}: {STEPS[current].title}
      </p>
    </nav>
  );
}

/** One step's fields under its heading; hidden, not unmounted, when not current. */
function StepPanel({
  index,
  current,
  headingRef,
  children,
}: {
  index: number;
  current: number;
  headingRef: RefObject<HTMLHeadingElement>;
  children: ReactNode;
}) {
  const on = index === current;
  return (
    // `hidden` alone loses to the `flex` class (same specificity, later in
    // the stylesheet), so the display class switches with it.
    <section
      hidden={!on}
      aria-labelledby={`event-step-${index}`}
      className={`${on ? "flex" : "hidden"} max-w-[1200px] flex-col gap-5`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2
        id={`event-step-${index}`}
        ref={on ? headingRef : undefined}
        tabIndex={-1}
        className="scroll-mt-6 text-2xl font-medium text-fg outline-none sm:text-3xl"
      >
        {STEPS[index].title}
        {STEPS[index].optional && (
          <span className="ml-3 align-middle text-base font-normal text-fg-muted">
            Optional
          </span>
        )}
      </h2>
      {/* The key for the asterisks, beside the heading rather than a row
          of its own above it. */}
      {!STEPS[index].optional && index < STEPS.length - 1 && (
        <p className="text-base text-fg-muted">
          <span className="text-danger-fg">*</span> Required
        </p>
      )}
      </div>
      {children}
    </section>
  );
}

/** A titled group on the Extras step. */
function ExtrasGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {title && <h3 className="text-xl font-medium text-fg">{title}</h3>}
      {children}
    </div>
  );
}

/**
 * Back / Next along the bottom; on the last step Next becomes Publish (or
 * Save). An edit can save from any step, since most edits are one field.
 */
function StepFooter({
  step,
  last,
  mode,
  submitting,
  submitLabel,
  submittingLabel,
  stillNeeded,
  onBack,
  onNext,
}: {
  step: number;
  last: number;
  mode: "create" | "edit";
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  /** This step's missing answers, once Next was pressed without them. */
  stillNeeded: string[];
  onBack: () => void;
  onNext: () => void;
}) {
  const final = step === last;
  const submit = (
    <Button
      type="submit"
      variant={final ? "primary" : "secondary"}
      size="lg"
      className="max-sm:w-full"
      disabled={submitting}
      trailingIcon={<Upload />}
    >
      {submitting ? submittingLabel : submitLabel}
    </Button>
  );
  return (
    <div className="flex max-w-[1200px] flex-col gap-3 border-t border-line pt-5">
      {/* Named, not just highlighted: the image and the topic chips have no
          box to turn red. */}
      {stillNeeded.length > 0 && (
        <p role="alert" className="text-lg text-danger-fg">
          Still needed on this step: {[...new Set(stillNeeded)].join(", ")}.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 max-sm:flex-col-reverse max-sm:items-stretch">
        {step > 0 && (
          <Button
            size="lg"
            onClick={onBack}
            leadingIcon={<ChevronLeft />}
            className="max-sm:w-full"
          >
            Back
          </Button>
        )}
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto max-sm:flex-col-reverse max-sm:items-stretch">
          {mode === "edit" && !final && submit}
          {final ? (
            submit
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={onNext}
              trailingIcon={<ChevronRight />}
              className="max-sm:w-full"
            >
              {step === last - 1 ? "Review" : `Next: ${STEPS[step + 1].title}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The last step: everything that was entered, by step, with a way back to each. */
function Review({
  values: v,
  mode,
  categoryLabel,
  problemsFor,
  onEdit,
}: {
  values: EventFormValues;
  mode: "create" | "edit";
  categoryLabel: (slug: string) => string;
  problemsFor: (step: number) => Problem[];
  onEdit: (step: number) => void;
}) {
  const startIso = v.date && v.time ? `${v.date}T${v.time}` : null;
  const endIso = v.date && v.endTime ? `${v.date}T${v.endTime}` : null;
  const pricing = templateFor(v.pricingModel);
  const repeat = FREQUENCIES.find((f) => f.value === v.frequency)?.label ?? "";
  const links = v.links.filter((l) => l.label.trim() && l.url.trim());
  const ages =
    v.minAge && v.maxAge
      ? `Ages ${v.minAge}–${v.maxAge}`
      : v.minAge
        ? `Ages ${v.minAge}+`
        : v.maxAge
          ? `Up to ${v.maxAge}`
          : "Any age";
  const price =
    v.pricingModel === "free"
      ? "Free"
      : v.pricingModel === "custom"
        ? v.priceNote || "Paid"
        : `${pricing.label}${v.priceAmount ? ` · $${v.priceAmount.replace(/^\$/, "")}` : ""}`;

  const groups: { step: number; rows: [string, ReactNode][] }[] = [
    {
      step: 0,
      rows: [
        ["Name", v.title || "—"],
        ["Activity type", v.categories.map(categoryLabel).join(", ") || "—"],
        [
          "Description",
          v.description ? (
            <span className="line-clamp-3 whitespace-pre-line">{v.description}</span>
          ) : (
            "—"
          ),
        ],
      ],
    },
    {
      step: 1,
      rows: [
        ["Date", startIso ? longDate(startIso) : "—"],
        ["Time", startIso ? timeRange(startIso, endIso) : "—"],
        ...(mode === "create"
          ? [
              [
                "Repeats",
                v.frequency === "once"
                  ? repeat
                  : `${repeat}, ${v.repeatForever ? "ongoing" : `${v.occurrenceCount || "?"} times`}`,
              ] as [string, ReactNode],
            ]
          : []),
        ["Where", `${v.isVirtual ? "Virtual" : "In person"}${v.location ? ` · ${v.location}` : ""}`],
      ],
    },
    {
      step: 2,
      rows: [
        ["Cost", price],
        ["Joining", v.requiresSignup ? "Registration" : "Drop-in"],
        [v.requiresSignup ? "Sign-up link" : "Posting link", v.registrationUrl || "None"],
      ],
    },
    {
      step: 3,
      rows: [
        ["Spots", v.capacity ? `${v.capacity} available` : "No limit"],
        ["Ages", `${ages}${v.isYouth ? " · Youth program" : ""}`],
        ["Accessibility", v.accessibilityTags.map(tagLabel).join(", ") || "None added"],
        ["Who can see it", v.accessMode === "group" ? "A special-access group" : "Everyone"],
      ],
    },
    {
      step: 4,
      rows: [
        ["Links", links.length ? links.map((l) => l.label).join(", ") : "None"],
        ["Extra details", v.notes ? <span className="line-clamp-2">{v.notes}</span> : "None"],
        ["Poster", v.posterUrl ? "Added" : "None"],
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {v.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={v.coverImageUrl}
          alt=""
          className="aspect-[2/1] w-full max-w-[420px] rounded-card object-cover"
        />
      )}
      {groups.map(({ step, rows }) => {
        const issues = problemsFor(step);
        return (
          <section
            key={step}
            aria-labelledby={`review-${step}`}
            className={`flex flex-col gap-3 rounded-card border p-5 sm:p-6 ${
              issues.length ? "border-danger-border" : "border-line"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id={`review-${step}`} className="text-xl font-medium text-fg">
                {STEPS[step].title}
              </h3>
              <Button
                variant="ghost"
                leadingIcon={<Pencil />}
                onClick={() => onEdit(step)}
                aria-label={`Edit ${STEPS[step].title}`}
              >
                Edit
              </Button>
            </div>
            {issues.length > 0 && (
              <p className="text-base text-danger-fg">
                Still needed: {issues.map((p) => p.text).join(", ")}.
              </p>
            )}
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
              {rows.map(([k, val]) => (
                <div key={k} className="contents">
                  <dt className="text-base text-fg-muted">{k}</dt>
                  <dd className="min-w-0 break-words text-lg text-fg">{val}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
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
  /** The last step's button: "Publish Event" / "Save Edits". */
  submitLabel: string;
  submittingLabel: string;
}) {
  const [showMissing, setShowMissing] = useState(false);
  // Steps whose Next was pressed with something missing: their fields show
  // their own errors from then on, without waiting for a whole-form submit.
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const { categories, label: categoryLabel } = useCategories();
  const problems = missingRequired(values, mode);
  const missing = problems.map((p) => p.text);
  /** A field's own message, once the summary is showing. */
  const fieldError = (field: string) =>
    showMissing || checked.has(stepOfField(field))
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

  // ---- steps ----
  const [step, setStep] = useState(0);
  // The furthest step reached: a new event opens steps in order, and any
  // step already reached can be revisited from the list. An edit opens all.
  const [reached, setReached] = useState(mode === "edit" ? STEPS.length - 1 : 0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    // Each step starts at its heading: in view, and where a screen reader
    // carries on from.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  const stepProblems = (i: number) =>
    problems.filter((p) => stepOfField(p.field) === i);
  const last = STEPS.length - 1;

  function goTo(i: number) {
    setStep(i);
    setReached((r) => Math.max(r, i));
  }
  function next() {
    if (stepProblems(step).length) {
      setChecked((c) => new Set(c).add(step));
      return;
    }
    goTo(Math.min(step + 1, last));
  }

  return (
    <form
      id={id}
      className="flex flex-col gap-5"
      // The summary and each field's own message say what's wrong; the
      // browser's bubbles arrived first and said it differently.
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        // Enter in a field moves a new event on rather than publishing it
        // from the first step; an edit saves from wherever it is.
        if (mode === "create" && step < last) {
          next();
          return;
        }
        if (problems.length) {
          setShowMissing(true);
          goTo(stepOfField(problems[0].field));
          return;
        }
        if (!submitting) onSubmit();
      }}
    >
      <StepList
        current={step}
        reached={reached}
        done={(i) => i < last && i < reached && stepProblems(i).length === 0}
        onPick={goTo}
      />

      <div id={`${id}-missing`} className="flex flex-col gap-2">
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

      {/* Every step stays mounted and only the current one shows, so an
          upload or a half-picked group survives moving between steps. */}
      <StepPanel index={0} current={step} headingRef={headingRef}>
        {/* Wide screens: the picture beside the words, so the whole step
            fits without scrolling. */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Section title="Event image" required={mode === "create"}>
              <ImageDrop
                compact
                label="Event image"
                value={values.coverImageUrl}
                onChange={(v) => set("coverImageUrl", v)}
              />
            </Section>
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
          </div>
          <div className="flex min-w-0 flex-col gap-5">
          <TextField
            label="Name of Event"
            required
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            error={fieldError("title")}
            placeholder="Open Space: Coffee & Chats"
            autoComplete="off"
          />
          <Section
            title="Activity Type"
            required
            lead="Members pick these topics as interests, so this helps the right people find your event. Choose all that fit."
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
                    <span aria-hidden="true">{categoryStyle(c.slug).emoji}</span>
                    &nbsp;{c.label}
                  </FilterChip>
                );
              })}
            </div>
          </Section>
          </div>
        </div>
      </StepPanel>

      <StepPanel index={1} current={step} headingRef={headingRef}>
        <div className="grid items-start gap-x-8 gap-y-5 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-5">
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
            <div className="flex flex-col gap-2">
              <p className="text-lg font-medium text-fg">
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
                <span aria-hidden="true" className="mt-6 h-px w-[30px] shrink-0 bg-fg-icon" />
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
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <Section title="Where">
              <div className="flex flex-col items-start gap-4">
                <SegmentedToggle<"virtual" | "inperson">
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
          </div>
        </div>
        {mode === "create" && (
          <Section title="Does it repeat?">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="How often" className="min-w-[200px]">
                <Select
                  value={values.frequency}
                  onChange={(e) => set("frequency", e.target.value as Frequency)}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
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
            {values.frequency !== "once" && (
              <p className="text-base text-fg-muted">
                Each date is posted separately, so people can save the ones they
                can make.
                {values.repeatForever &&
                  " We'll post dates about two years ahead and keep adding more."}
              </p>
            )}
          </Section>
        )}
      </StepPanel>

      <StepPanel index={2} current={step} headingRef={headingRef}>
        <div className="grid items-start gap-x-8 gap-y-5 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-5">
            <Section title="Cost">
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
                        className={`flex cursor-pointer items-start gap-3 rounded-control border px-3 py-2 ${
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
                          <span className="block text-sm text-fg-muted">
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
                {values.pricingModel === "series" && (
                  <p className="text-base text-fg-muted">
                    Signing up once enrols the member in every date in this series.
                  </p>
                )}
              </Section>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <Section title="How people join">
              <div className="flex flex-col items-start gap-4">
                <SegmentedToggle<"dropin" | "registration">
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
                className={`text-base ${
                  signupHint?.tone === "warn"
                    ? "rounded-control bg-tag-dropin-bg px-3 py-2 text-tag-dropin-fg"
                    : "text-fg-muted"
                }`}
              >
                {signupHint?.tone === "warn"
                  ? signupHint.message
                  : values.requiresSignup
                    ? "Where people register on your own site. Leave it blank if they sign up here instead."
                    : "The program's page on your own site, if it has one."}
              </p>
            </div>
          </div>
        </div>
      </StepPanel>

      <StepPanel index={3} current={step} headingRef={headingRef}>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-5">
            <ExtrasGroup title="Spots and ages">
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
            </ExtrasGroup>
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <ExtrasGroup>
              <Section
                title="What does it offer?"
                lead="Only tick what you're sure of. Leaving one unticked doesn't mean no."
              >
                <div className="flex flex-wrap gap-2">
                  {SELECTABLE_TAGS.map(({ slug, label, emoji }) => {
                    const on = values.accessibilityTags.includes(slug);
                    return (
                      <FilterChip
                        key={slug}
                        selected={on}
                        onClick={() => toggle("accessibilityTags", slug)}
                      >
                        <span aria-hidden="true">{emoji}</span>
                        &nbsp;{label}
                      </FilterChip>
                    );
                  })}
                </div>
              </Section>
            </ExtrasGroup>
            <ExtrasGroup>
              <Section
                title="Who can see this"
                lead="Everyone, or only people you've approved into a special-access group."
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
            </ExtrasGroup>
          </div>
        </div>
      </StepPanel>

      <StepPanel index={4} current={step} headingRef={headingRef}>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-5">
            <ExtrasGroup>
              <Section
                title="Important Links"
                lead="Up to three, like a flyer, a map or your own page. Each needs a label and a web address."
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
            </ExtrasGroup>
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <ExtrasGroup>
              <Field label="Extra details">
                <TextArea
                  rows={3}
                  value={values.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="What to bring, who to ask for, anything that varies week to week."
                />
              </Field>
            </ExtrasGroup>
            <ExtrasGroup>
              <Section
                title="Printable poster"
                lead="Your own flyer: a PDF, PNG or JPEG up to 4 MB. Members can open it from the program's page. The details page has a QR code for that page."
              >
                <PosterField
                  value={values.posterUrl}
                  onChange={(v) => set("posterUrl", v)}
                />
              </Section>
            </ExtrasGroup>
          </div>
        </div>
      </StepPanel>

      <StepPanel index={5} current={step} headingRef={headingRef}>
        <Review
          values={values}
          mode={mode}
          categoryLabel={categoryLabel}
          problemsFor={stepProblems}
          onEdit={goTo}
        />
      </StepPanel>

      <StepFooter
        step={step}
        last={last}
        mode={mode}
        submitting={submitting}
        submitLabel={submitLabel}
        submittingLabel={submittingLabel}
        stillNeeded={
          step < last && checked.has(step)
            ? stepProblems(step).map((p) => p.text)
            : []
        }
        onBack={() => goTo(Math.max(step - 1, 0))}
        onNext={next}
      />
    </form>
  );
}
