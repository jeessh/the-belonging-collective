export const API =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * The human-readable part of a failed response.
 *
 * `ApiError.message` is the raw body, and FastAPI sends `{"detail": "..."}` —
 * rendering that straight into the UI shows people JSON. Pull `detail` out when
 * it's there, otherwise fall back to something we wrote.
 */
export function apiMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  try {
    const parsed = JSON.parse(err.message) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail) return parsed.detail;
  } catch {
    /* not JSON — fall through */
  }
  return fallback;
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include", // send/receive the httpOnly auth cookie
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

// Uploads via FormData (not api()) so the browser sets the multipart boundary;
// forcing application/json would break it.
export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API}/events/images`, {
    method: "POST",
    credentials: "include",
    body,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const data = (await res.json()) as { url: string };
  return data.url;
}

/** A printable poster — PDF, PNG or JPEG, at most 4 MB — for `poster_url`. */
export async function uploadPoster(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API}/events/posters`, {
    method: "POST",
    credentials: "include",
    body,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const data = (await res.json()) as { url: string };
  return data.url;
}

export type EventImage = { id: string; url: string; caption?: string | null };

/** An important link shown alongside a program — not the registration link. */
export type EventLink = { label: string; url: string };

export type Event = {
  id: string;
  host_id: string;
  host_name: string;
  host_logo_url?: string | null;
  title: string;
  description: string;
  /** Extra details, shown under the description in the detail popup. */
  notes?: string | null;
  /** Every topic it's about. `category` is the first of these. */
  categories?: string[];
  category?: string | null;
  /** The shape of the program (Class, Drop-in, Outing) — see lib/activities. */
  activity_type?: string | null;
  location?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  accessibility_tags: string[];
  is_free: boolean;
  capacity?: number | null;
  /** Human-readable id, e.g. 1042. UUIDs are for machines. */
  event_no?: number;
  series_id?: string | null;
  recurrence?: string | null;
  series_index?: number | null;
  series_total?: number | null;
  pricing_model?:
    | "free"
    | "donation"
    | "per_session"
    | "per_group"
    | "series"
    | "custom";
  price_cents?: number | null;
  price_group_size?: number | null;
  price_sessions?: number | null;
  price_note?: string | null;
  /** Built server-side from the structured fields, so every surface agrees. */
  price_label?: string;
  /** "N going". Null when the viewer isn't signed in — the API withholds it. */
  saved_count?: number | null;
  /** Registration-link clicks. Only filled for a signed-in organizer. */
  click_count?: number | null;
  /** The login that posted it; `host_id` is the owning organization. */
  created_by_host_id?: string | null;
  /** Who posted it and their picture — signed-in organizers only, else null. */
  created_by_name?: string | null;
  created_by_picture?: string | null;
  min_age?: number | null;
  max_age?: number | null;
  /** Virtual or in person; youth or everyone. Both filter the admin list. */
  is_virtual?: boolean;
  is_youth?: boolean;
  requires_signup: boolean;
  /**
   * Where registering happens. Only meaningful when `requires_signup` — a
   * drop-in program is saved the same way either way. "external" means the
   * member leaves for `registration_url`.
   */
  registration_mode: "internal" | "external";
  registration_url?: string | null;
  /** Up to three. */
  links?: EventLink[];
  cover_image_url?: string | null;
  /** The agency's own flyer — a PDF, PNG or JPEG from POST /events/posters. */
  poster_url?: string | null;
  /**
   * Special access. Null = public. Set = only members approved into this
   * group (and the owning organization) find it in lists; every by-id route
   * still serves it, so it opens from a link or QR code.
   */
  access_group_id?: string | null;
  access_group?: { id: string; name: string } | null;
  /**
   * This member's standing with `access_group`. Only set for a signed-in
   * member on a restricted program; null otherwise.
   */
  access_status?: AccessStatus | "none" | null;
  /** Capacity minus the holds still running; null without a capacity. */
  spots_left?: number | null;
  /** When the signed-in member's own hold runs out; null when they have none. */
  held_until?: string | null;
  images: EventImage[];
};

/** What POST /events/{id}/attend answers. `held_until` is null when the
    program has no capacity, or no spot was left to hold. */
export type AttendResult = {
  ok: boolean;
  already?: boolean;
  held_until?: string | null;
};

export const attendEvent = (eventId: string) =>
  api<AttendResult>(`/events/${eventId}/attend`, { method: "POST" });

/** How the member last chose to see the feed. */
export type PreferredView = "card" | "list";

export type Me = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  /** The login. Null only on a legacy icon account, which can't sign in. */
  email?: string | null;
  /** Profile picture: a photo or an emblem slug (lib/emblems), never both. */
  avatar_url?: string | null;
  avatar_emblem?: string | null;
  /** "password", or "icon" for a legacy account that needs one set. */
  auth_type: "icon" | "password";
  accessibility_prefs: string[];
  interest_categories: string[];
  tts_enabled: boolean;
  voice_commands_enabled: boolean;
  eye_tracking_enabled: boolean;
  preferred_view: PreferredView;
  /**
   * Recommendations the member dismissed. A program id is the event's
   * `series_id` when it has one, else its `id`. Capped server-side at 500
   * entries of up to 64 chars; PATCH replaces the whole list.
   */
  dismissed_program_ids: string[];
  /** When the first-run tour was seen; null until then. */
  onboarded_at: string | null;
  /** Supports a member — opens the caregiver tools. Support, not proxy. */
  is_caregiver: boolean;
  /** Members this account is linked to (saves for), and who saves for it. */
  care: CarePerson[];
  caregivers: CarePerson[];
  /** What the calendar buttons offer — see lib/calendar.googleCalendarButton. */
  google_calendar?: GoogleCalendarState;
};

/**
 * `connected`: the saved list is synced into a calendar in their Google
 * account. `available`: Google sign-in is set up, not yet used. `off`: it
 * isn't set up, and the buttons subscribe to the feed instead.
 */
export type GoogleCalendarState = "connected" | "available" | "off";

/** Stop syncing; the app's calendar leaves their Google account. */
export const disconnectGoogleCalendar = () =>
  api<null>("/users/me/google-calendar", { method: "DELETE" });

/** Fields a member can update on themselves via PATCH /users/me. */
export type MePrefs = Partial<
  Pick<
    Me,
    | "accessibility_prefs"
    | "interest_categories"
    | "tts_enabled"
    | "voice_commands_enabled"
    | "eye_tracking_enabled"
    | "preferred_view"
    | "dismissed_program_ids"
    | "email"
    | "avatar_emblem"
    | "is_caregiver"
  >
> & {
  /** `true` stamps `onboarded_at` with now; `false` is ignored. */
  onboarded?: boolean;
  /** Only null: a photo is set through `uploadAvatar`, this only removes it. */
  avatar_url?: null;
};

export const updateMe = (body: MePrefs) =>
  api<Me>("/users/me", { method: "PATCH", body: JSON.stringify(body) });

/** A profile photo — PNG, JPEG or WebP, at most 2 MB. Replaces any emblem. */
export async function uploadAvatar(file: File): Promise<Me> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API}/users/me/avatar`, {
    method: "POST",
    credentials: "include",
    body,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as Me;
}

/** The member's list handle; the same token comes back every time. */
export const createShareLink = () =>
  api<{ token: string }>("/users/me/share-link", { method: "POST" });

/**
 * POST /share/email: the site mails these programs to `to`, as designed
 * cards under the member's name. `withListLink` adds their live list page.
 */
export const shareByEmail = (body: {
  to: string;
  event_ids: string[];
  with_list_link?: boolean;
  for_member?: string | null;
}) => api<null>("/share/email", { method: "POST", body: JSON.stringify(body) });

/** The member's private calendar-feed handle; the same token every time. */
/** The feed's token, and whether a calendar has fetched it lately. */
export const createCalendarFeed = () =>
  api<{ token: string; subscribed: boolean }>("/users/me/calendar-feed", {
    method: "POST",
  });

export const sharedListUrl = (token: string, origin?: string) =>
  `${origin ?? window.location.origin}/shared/${token}`;

/** GET /shared/{token}: a member's upcoming saved public programs. */
export type SharedList = { first_name: string; events: Event[] };

/**
 * The whole feed. Paginated, not a bare call: the API defaults to 100 and
 * caps at 200, so a single request silently truncates the feed once the
 * agencies get going — and "personalization sorts, never filters" quietly
 * stops being true. Signed in, the rows carry `saved_count`; signed out they
 * carry null, so the feed re-reads this on sign-in.
 */
export async function fetchAllEvents(org?: string | null): Promise<Event[]> {
  const PAGE = 200;
  const all: Event[] = [];
  const only = org ? `&org=${encodeURIComponent(org)}` : "";
  for (let offset = 0; offset < 5000; offset += PAGE) {
    const page = await api<Event[]>(`/events?limit=${PAGE}&offset=${offset}${only}`);
    all.push(...page);
    if (page.length < PAGE) break;
  }
  return all;
}

/**
 * Sign out one side: the member app by default, the console with "host".
 * Members and organizers have separate sessions, so one doesn't end the other.
 */
export const logout = (role: "user" | "host" = "user") =>
  api(`/auth/logout${role === "host" ? "?role=host" : ""}`, { method: "POST" });

/* ---------------- caregivers ---------------- */

/**
 * One side of a care link as the other sees it. A caregiver's `last_name` is
 * the initial only when a member is looking.
 */
export type CarePerson = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  avatar_emblem?: string | null;
  /** The member's email, when a caregiver is looking; never the other way. */
  email?: string | null;
};

/** "Sam R." — the short form every surface uses for a linked person. */
export const shortName = (p: { first_name: string; last_name: string }) =>
  `${p.first_name} ${p.last_name.charAt(0)}.`.trim();

/** What a member types to sign in. */
export type MemberCredential = { email: string; password: string };

/** A caregiver creating the member's account. */
export const createCareMember = (
  body: MemberCredential & { first_name: string; last_name: string },
) =>
  api<{ id: string; first_name: string; last_name: string; email: string }>(
    "/users/me/care/members",
    { method: "POST", body: JSON.stringify(body) },
  );

/** Link an existing member by proving their credential. 401 when it's wrong. */
export const linkCareMember = (body: MemberCredential) =>
  api<CarePerson>("/users/me/care/links", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const unlinkCareMember = (memberId: string) =>
  api(`/users/me/care/${memberId}`, { method: "DELETE" });

/** The member's side: drop one of the people who support them. */
export const removeCaregiver = (caregiverId: string) =>
  api(`/users/me/caregivers/${caregiverId}`, { method: "DELETE" });

export const fetchCareEvents = (memberId: string) =>
  api<Event[]>(`/users/me/care/${memberId}/events`);

/** Save / un-save *for* a linked member. The row is theirs, so are the rules. */
export const attendEventFor = (memberId: string, eventId: string) =>
  api<AttendResult>(`/users/me/care/${memberId}/events/${eventId}/attend`, {
    method: "POST",
  });

export const unattendEventFor = (memberId: string, eventId: string) =>
  api(`/users/me/care/${memberId}/events/${eventId}/attend`, {
    method: "DELETE",
  });

export const careCalendarUrl = (memberId: string) =>
  `${API}/users/me/care/${memberId}/events/calendar.ics`;

/**
 * The member's own invitation to a caregiver, still waiting for an answer.
 * `link` comes back once, when it is made — only its hash is stored.
 */
export type CaregiverInvite = {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
  link?: string;
};

export const fetchCaregiverInvites = () =>
  api<CaregiverInvite[]>("/users/me/caregivers/invites");

/** Mail an invitation; inviting the same email again replaces the old one. */
export const inviteCaregiver = (email: string) =>
  api<CaregiverInvite>("/users/me/caregivers/invites", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const withdrawCaregiverInvite = (inviteId: string) =>
  api(`/users/me/caregivers/invites/${inviteId}`, { method: "DELETE" });

/** What the accept page shows: who is asking, and which email must accept. */
export type CareInvitePreview = {
  member: string;
  member_first_name: string;
  email: string;
};

export const previewCareInvite = (token: string) =>
  api<CareInvitePreview>(`/care-invites/${encodeURIComponent(token)}`);

/** Accept as the signed-in account; 403 unless it is the invited email. */
export const acceptCareInvite = (token: string) =>
  api<CarePerson>(`/care-invites/${encodeURIComponent(token)}/accept`, {
    method: "POST",
  });

/* ---------------- special access ---------------- */

/** A membership row's status. Rows are never deleted; they move between these. */
export type AccessStatus = "requested" | "approved" | "declined" | "revoked";

/** A per-organization group a member is approved into. */
export type AccessGroup = {
  id: string;
  host_id: string;
  host_name: string;
  name: string;
  created_at: string;
  /** Requests waiting on the organization. */
  pending_count: number;
  approved_count: number;
};

/** The member's own view of a request. */
export type AccessMembership = {
  group_id: string;
  status: AccessStatus;
  requested_at: string;
  decided_at?: string | null;
};

/** One row of the console's members list for a group. */
export type AccessMember = {
  user_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  status: AccessStatus;
  requested_at: string;
  decided_at?: string | null;
  /** The program whose page they asked from, if any. */
  requested_via?: { id: string; title: string } | null;
};

/**
 * A member asks to join a group, usually from a restricted program's page.
 * Idempotent while requested or approved; 409 once declined or revoked.
 */
export const requestAccess = (groupId: string, eventId?: string) =>
  api<AccessMembership>(`/access-groups/${groupId}/request`, {
    method: "POST",
    body: JSON.stringify({ event_id: eventId ?? null }),
  });

/* Topics (superadmin CRUD; the public read lives in lib/categories). */
export type CategoryRow = {
  slug: string;
  label: string;
  sort_order: number;
  /** Live programs filed under it. */
  event_count: number;
};

export const createCategory = (label: string) =>
  api<CategoryRow>("/categories", {
    method: "POST",
    body: JSON.stringify({ label }),
  });

export const updateCategory = (
  slug: string,
  patch: { label?: string; sort_order?: number },
) =>
  api<CategoryRow>(`/categories/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export type CategoryArchived = {
  slug: string;
  reassigned_to: string | null;
  affected_events: number;
  affected_members: number;
};

/** Archives. 409 while live programs use the topic and no `reassignTo` is given. */
export const archiveCategory = (slug: string, reassignTo?: string) =>
  api<CategoryArchived>(
    `/categories/${slug}${reassignTo ? `?reassign_to=${encodeURIComponent(reassignTo)}` : ""}`,
    { method: "DELETE" },
  );

/* Organizer side: own groups only, every group for a superadmin. */
export const fetchAccessGroups = () => api<AccessGroup[]>("/access-groups");

export const createAccessGroup = (name: string, hostId?: string) =>
  api<AccessGroup>("/access-groups", {
    method: "POST",
    body: JSON.stringify({ name, host_id: hostId ?? null }),
  });

export const renameAccessGroup = (groupId: string, name: string) =>
  api<AccessGroup>(`/access-groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });

/** Archives. 409 while live programs still use the group. */
export const archiveAccessGroup = (groupId: string) =>
  api(`/access-groups/${groupId}`, { method: "DELETE" });

export const fetchAccessMembers = (groupId: string, status?: AccessStatus) =>
  api<AccessMember[]>(
    `/access-groups/${groupId}/members${status ? `?status=${status}` : ""}`,
  );

export const decideAccess = (
  groupId: string,
  userId: string,
  decision: "approve" | "decline" | "revoke",
) =>
  api<AccessMember>(`/access-groups/${groupId}/members/${userId}/${decision}`, {
    method: "POST",
  });

/** What happened to each address added to a group (no approval step). */
export type AddPeopleResult = {
  /** Had an account: in the group now. */
  added: { email: string; name: string }[];
  /** Already in the group, or already invited. */
  already: string[];
  /** No account yet: invited, and in as soon as they sign up. */
  invited: string[];
  invalid: string[];
};

export const addPeopleToGroup = (groupId: string, emails: string[]) =>
  api<AddPeopleResult>(`/access-groups/${groupId}/people`, {
    method: "POST",
    body: JSON.stringify({ emails }),
  });

export type GroupInvite = { id: string; email: string; created_at: string };

export const fetchGroupInvites = (groupId: string) =>
  api<GroupInvite[]>(`/access-groups/${groupId}/invites`);

export const withdrawGroupInvite = (groupId: string, inviteId: string) =>
  api(`/access-groups/${groupId}/invites/${inviteId}`, { method: "DELETE" });

/* ---------------- admin console ---------------- */

/** A member account, as the superadmin-only `GET /users` returns it. */
export type MemberAccount = Me & { created_at?: string };

/**
 * An organizer login. Two tiers, both on the organization's record:
 *   • admin      (is_admin false) — manages only its own programs
 *   • superadmin (is_admin true)  — manages any program, members, and admins
 * A staff login (`org_id` set) is one person at an organization; it acts as
 * the organization and takes its tier. `name` is then the person's.
 */
export type AdminAccount = {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  /** Organization logo, shown in the member feed's organization stepper. */
  logo_url?: string | null;
  /** Set on a staff login: the organization it belongs to. */
  org_id?: string | null;
  /** The organization's own page, `/o/{slug}` — its programs and nobody else's. */
  slug?: string | null;
  /** False: its programs are on its own page only, not the shared feed. */
  in_shared_feed?: boolean;
  created_at: string;
  /** Programs this account owns — shown before a removal retires them. */
  event_count: number;
  /** The organization's staff logins (superadmin list only). */
  staff?: AdminAccount[];
};

/** `GET /hosts/me`: the signed-in person and the organization they act for. */
export type HostMe = Omit<AdminAccount, "event_count" | "staff"> & {
  is_staff: boolean;
  /** The organization — the login itself, for a shared login. */
  org: Omit<AdminAccount, "event_count" | "staff">;
};

export type Session = {
  authenticated: boolean;
  role?: "user" | "host";
  is_admin?: boolean;
  id?: string;
  /** Hosts only: the organization the login acts for. */
  org_id?: string;
  /** Members only. */
  email?: string | null;
  auth_type?: "icon" | "password";
  avatar_url?: string | null;
  avatar_emblem?: string | null;
  is_caregiver?: boolean;
  care?: CarePerson[];
  caregivers?: CarePerson[];
};

/** The console's organizer session (members read /users/me). */
export const getSession = () => api<Session>("/auth/me?role=host");

export const getHostMe = () => api<HostMe>("/hosts/me");

/* ---------------- team: an organization's own logins ---------------- */

export type StaffInvite = {
  id: string;
  name: string;
  email: string;
  expires_at: string;
  expired: boolean;
};

export type Team = {
  org: HostMe["org"];
  staff: HostMe["org"][];
  invites: StaffInvite[];
};

/** Your own organization's team; a superadmin may ask for another's. */
export const fetchTeam = (orgId?: string) =>
  api<Team>(`/hosts/team${orgId ? `?org_id=${orgId}` : ""}`);

/** Invite a person to join an organization as a staff login. */
export const inviteStaff = (body: { org_id: string; name: string; email: string }) =>
  api<{ id: string; token: string; name: string; email: string; emailed: boolean }>("/invites", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** Archives one staff login; the organization and its programs stay. */
export const removeStaff = (staffId: string) =>
  api(`/hosts/team/${staffId}`, { method: "DELETE" });

/* ---------------- calendar import (superadmins) ---------------- */

/** One program read from a calendar, as the preview shows it. */
export type ImportProgram = {
  key: string;
  title: string;
  description: string;
  location: string | null;
  who: string | null;
  /** The organization as the calendar names it. */
  org_label: string | null;
  /** The platform organization it matched, or null. */
  host_id: string | null;
  links: EventLink[];
  is_free: boolean;
  is_virtual: boolean;
  min_age: number | null;
  /** Guessed topic slugs. */
  categories: string[];
  dates: { starts_at: string; ends_at: string | null }[];
  recurrence: string | null;
  /** For an audience that registered elsewhere ("People who registered…"). */
  restricted: boolean;
  duplicate: { id: string; title: string } | null;
  problems: string[];
};

export const previewCalendarImport = (source: { url?: string; ics?: string }) =>
  api<{ programs: ImportProgram[]; organizations: { id: string; name: string }[] }>(
    "/imports/calendar/preview",
    { method: "POST", body: JSON.stringify(source) },
  );

export type ImportProgramIn = Omit<
  ImportProgram,
  "key" | "org_label" | "host_id" | "restricted" | "duplicate" | "problems"
> & { host_id: string; access_group_id: string | null };

export const commitCalendarImport = (programs: ImportProgramIn[]) =>
  api<{ programs: number; events: number }>("/imports/calendar/commit", {
    method: "POST",
    body: JSON.stringify({ programs }),
  });

/* ---------------- analytics ---------------- */

export type AnalyticsWeek = {
  /** Monday, YYYY-MM-DD. */
  week: string;
  saves: number;
  clicks: number;
  postings: number;
};

export type AnalyticsProgram = {
  program_id: string;
  event_id: string;
  title: string;
  starts_at: string | null;
  host_id: string;
  host_name: string;
  saves: number;
  going: number;
  clicks: number;
  archived: boolean;
};

export type Analytics = {
  from: string;
  to: string;
  host_id: string | null;
  host_name: string | null;
  totals: {
    /** Saves in the range, including ones later undone — they still happened. */
    saves: number;
    unique_savers: number;
    clicks: number;
    /** Distinct programs posted (a repeating program counts once). */
    postings: number;
  };
  weekly: AnalyticsWeek[];
  programs: AnalyticsProgram[];
};

export type AnalyticsParams = { from?: string; to?: string; host_id?: string };

function analyticsQuery(params: AnalyticsParams): string {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.host_id) q.set("host_id", params.host_id);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const fetchAnalytics = (params: AnalyticsParams) =>
  api<Analytics>(`/analytics${analyticsQuery(params)}`);

/** The same numbers as a spreadsheet — a plain link, so the browser downloads it. */
export const analyticsCsvUrl = (params: AnalyticsParams) =>
  `${API}/analytics.csv${analyticsQuery(params)}`;

/** The same export as an Excel file: real dates, columns already sized. */
export const analyticsXlsxUrl = (params: AnalyticsParams) =>
  `${API}/analytics.xlsx${analyticsQuery(params)}`;

/** An organization's own page: `GET /hosts/spaces/{slug}` (public). */
export type OrgSpace = { name: string; slug: string; logo_url: string | null };

export const fetchOrgSpace = (slug: string) =>
  api<OrgSpace>(`/hosts/spaces/${encodeURIComponent(slug)}`);

/** The full address of an organization's own page, for copying. */
export const orgSpaceUrl = (slug: string) =>
  `${typeof window === "undefined" ? "" : window.location.origin}/o/${slug}`;

export const listAdmins = () => api<AdminAccount[]>("/hosts");

export const createAdmin = (body: {
  name: string;
  email: string;
  password: string;
  is_admin: boolean;
  logo_url?: string | null;
  in_shared_feed?: boolean;
}) => api<AdminAccount>("/hosts", { method: "POST", body: JSON.stringify(body) });

/** An organization changing its own logo — every account may do this. */
export const updateMyOrg = (patch: { logo_url: string | null }) =>
  api<HostMe>("/hosts/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const updateAdmin = (
  id: string,
  body: {
    name?: string;
    is_admin?: boolean;
    password?: string;
    /** "" clears the logo; omitting leaves it alone. */
    logo_url?: string;
    in_shared_feed?: boolean;
  },
) =>
  api<AdminAccount>(`/hosts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export type HostInvite = {
  id: string;
  organization: string;
  email: string;
  is_admin: boolean;
  expires_at: string;
  expired: boolean;
};

export const listInvites = () => api<HostInvite[]>("/invites");

/** The token comes back once — it isn't stored in the clear. */
export const createInvite = (body: {
  organization: string;
  email: string;
  is_admin: boolean;
  /** Where the new organization's programs appear; true is the shared feed too. */
  in_shared_feed?: boolean;
}) =>
  /** `emailed`: false when the mail didn't go out — the link still works. */
  api<{ id: string; token: string; organization: string; email: string; emailed: boolean }>(
    "/invites",
    { method: "POST", body: JSON.stringify(body) },
  );

export const revokeInvite = (id: string) =>
  api(`/invites/${id}`, { method: "DELETE" });

export const deleteAdmin = (id: string) =>
  api(`/hosts/${id}`, { method: "DELETE" });

export const listMembers = () => api<MemberAccount[]>("/users");

/** A temporary password comes back once, to be read out. */
export const createMember = (body: {
  first_name: string;
  last_name: string;
  email: string;
}) =>
  api<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  }>("/users", { method: "POST", body: JSON.stringify(body) });

export const updateMember = (
  id: string,
  body: { first_name?: string; last_name?: string },
) =>
  api<MemberAccount>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

/**
 * Give a member a temporary password under this email. The old credential
 * and its sessions stop working immediately; a legacy icon account becomes
 * a password account.
 */
export const setMemberPassword = (id: string, email: string) =>
  api<{ id: string; email: string; password: string }>(
    `/users/${id}/set-password`,
    { method: "POST", body: JSON.stringify({ email }) },
  );

export const deleteMember = (id: string) =>
  api(`/users/${id}`, { method: "DELETE" });
