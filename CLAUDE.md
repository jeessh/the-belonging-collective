# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# The Belonging Collective

Accessible, needs-first community-programming platform for Kitchener-Waterloo
nonprofits (hackathon build). Members discover/attend programs via a tactile,
one-card-at-a-time UI; sign-in is the member's choice of a memorable **2-icon
key that IS the password** (`ICON_COUNT` in `app/core/icons.py` — it has been
1 and 3 before, so read it rather than assuming) or an **email + password**
(`users.auth_type`). Password accounts still hold an allocated icon set for the
unique constraint, but it is never shown.

## Layout
- `backend/` — FastAPI + SQLAlchemy. **Source of truth for the API.**
- `frontend/` — Next.js (App Router) + Tailwind + Framer Motion. Two distinct
  surfaces: the member app (`/` is the feed, `/signup`, and the public
  per-program pages at `/events/{id}`) and the staff admin console (`/host/*`).
  They deliberately do not look alike — see below. There is no `/events` index
  route — the feed is the home page, and `/events` 307s to it.
- `vercel.json` (root) — single-origin deploy: `/api/*` → backend, `/*` → frontend.

## Run locally
```bash
# backend → http://localhost:8000
cd backend && .venv/bin/uvicorn app.main:app --reload
# frontend → http://localhost:3000
cd frontend && npm run dev
```
`backend/.env` (gitignored) holds `DATABASE_URL` + `JWT_SECRET`. Apply the schema
with `.venv/bin/alembic upgrade head`, then seed with
`.venv/bin/python -m app.seed` (idempotent; skips if hosts exist).

**Alembic owns the schema.** Nothing creates tables on startup any more —
`create_all` only ever emitted `CREATE TABLE IF NOT EXISTS`, so a new column
worked locally and then 500'd every query in production against the un-ALTERed
table. Model change → `alembic revision --autogenerate` → deploy → run
`upgrade head` against prod. The baseline revision is idempotent so it is safe
against the hand-provisioned Supabase database; no `alembic stamp` needed.
Frontend also has `npm run typecheck` (`tsc --noEmit`) and `npm run build`.
Interactive API docs: http://localhost:8000/docs. **There is no test suite,
linter, or CI** — verify changes by running the app and typecheck.

## Database (Supabase)
- Project ref `xybhshhcgdvfgryklsze`, region `aws-1-us-west-2`.
- Pooler host `aws-1-us-west-2.pooler.supabase.com` — **:5432 session** (local),
  **:6543 transaction** (serverless/Vercel). URL prefix must be `postgresql+psycopg://`.
- Auth is **custom cookie-based** (not Supabase Auth); RLS is intentionally off —
  never expose the anon key or hit the DB from the browser.

## Same-origin deploy (why it matters)
Auth cookie is `SameSite=Lax`, frontend fetches with `credentials:"include"`, so FE
and BE **must share one origin**. In prod set `NEXT_PUBLIC_API_URL=/api`; FastAPI
uses `settings.ROOT_PATH` (`""` local, `/api` prod).

Required prod env: `DATABASE_URL` (:6543), `JWT_SECRET`, `COOKIE_SECURE=true`,
`NEXT_PUBLIC_API_URL=/api`, `FRONTEND_ORIGIN`, `ROOT_PATH=/api`.

Organizer password reset and invitations need SMTP: `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` (plus `SMTP_STARTTLS` / `SMTP_SSL`).
**Unset means no mail is sent and the link is written to the log instead** —
right for local dev, never acceptable in production. `FRONTEND_ORIGIN` is what
the links in that mail (and in the `.ics` exports) are built from, so a wrong
value produces links nobody can open.

## Frontend architecture

### Member app
- `components/EventsView.tsx` (~900 lines) is the member feed and orchestrates
  every accessibility mode below. Its parts live in `components/member/`:
  `FeedHeader` (account + the Accessibility Tools menu), `SavedSidebar` (the
  saved column — open panel from `lg`, collapsed rail on a tablet, a bar
  under the feed on a phone; its forwarded ref is the drop target every save
  animates into, whichever of the three is showing), `FeedFilters` (chips +
  sort; one scrolling row on a phone), `FeedCard` (the one card, on
  `ui/EventSummary`), `ListFeed` (the rows, with the "For you this week"
  section on top) and `Tour` (the first-run walk-through). The saved list
  overlay (`components/SavedEvents.tsx`) opens from "See Saved Events".
- **Two things a member's profile remembers about the feed itself:**
  `Me.preferred_view` (card | list — the feed opens in it and the toggle
  PATCHes it) and `Me.onboarded_at` (the tour is shown once, then stamped by
  `PATCH /users/me {onboarded: true}` on Start or Skip). Signed out, both
  live in `localStorage` (`tbc.preferred_view`, `tbc.toured`), every read and
  write wrapped in try/catch. The tour spotlights `data-tour="…"` targets
  (`arrows`, `save`, `more`, `filters`, `view`, `foryou`, `a11y`) — keep those
  attributes when moving a control — and is never mounted over sign-in or
  head-tracking calibration; "Show me around" in Accessibility Tools replays
  it.
- **Layout is desktop-first, reflowed at Tailwind's `sm` / `lg`.** Phone
  (< 640) stacks: the card goes image-over-text with ↑ / ↓ under it and drags
  on the x axis only (`touch-action: pan-y`, so a finger still scrolls);
  `Modal` becomes a full-height sheet with 16px gutters; `EventSummary` rows
  stack everywhere they are used. Tablet keeps the desktop shapes with
  tighter gutters. Anything that has to swap components rather than classes
  (the bar, the console's Filters sheet) reads `lib/useMediaQuery`, which is
  false on the server so the first paint is always the desktop markup.
- **Every save path ends in `flyToDrop`** — drag the card left into the
  sidebar, ← held ~1 s (`useHold`), the Save button, voice "save" and the
  head-tracking left edge. Keyboard mirrors the screen: ↑ previous, ↓ next, ←
  hold saves; head zones are left = save, right = saved list, up/down =
  previous/next (`useHeadTracking`). A new save path should call `flyToDrop`,
  not `attend`, or it skips the animation; the toast comes from `attend`.
- **Accessibility modes are per-member toggles**, persisted on the user (`Me.tts_enabled`,
  `voice_commands_enabled`, `eye_tracking_enabled`) and loaded from `GET /auth/me`.
  Each is a hook in `lib/`: `useTextToSpeech`, `useSpeechCommands`,
  `useHeadTracking` (head-pose cursor + `CalibrationOverlay`), `useHold`
  (the ← hold). Toggling a mode PATCHes `/users/me` and flips the
  hook — keep the persisted pref and the active hook in sync.
- `lib/feed.ts` orders the feed by match score (interest == `event.category`,
  pref ∈ `accessibility_tags`). **Personalization sorts, it never filters** —
  nothing is hidden. The only things that remove cards are the filter chips in
  `FeedFilters` (FREE + `CATEGORIES`), which are the member's own explicit
  choice; "For you" (match score) vs "Soonest" (server order) is the only sort.
  Ties fall back to the server's deterministic order, so the feed never
  reshuffles between renders.
- **"For you this week"** (`recommendedThisWeek` in `lib/feed.ts`): up to six
  programs with `matchScore > 0` starting in the next seven days, one per
  program, for a signed-in member with at least one interest or need. It is a
  section over the list and an opt-in "For you" chip in the card view (a chip
  is the member's choice, so it may filter) — never a change to the feed
  itself. "Not for me" writes the program id (`series_id ?? id`) to
  `Me.dismissed_program_ids` (PATCH replaces the whole list) and only removes
  the row from the section; the toast's Undo writes the list back.
- `saved_count` is null for anonymous viewers, so `ui/GoingCount` shows "See
  who else is going" and opens sign-in (or links to `/signup?next=` on the
  server-rendered page). The feed re-reads `/events` on sign-in
  (`fetchAllEvents`) so the counts appear, and nulls them on sign-out.
- **One listing, three surfaces.** `member/EventDetails` (no hooks) draws the
  full program — summary, DETAILS, POSTER (`event.poster_url`, opened in a new
  tab: a thumbnail for an image, a file icon and "Poster (PDF)" by extension),
  LINKS (`event.links` plus the organizer's `registration_url`) — for the
  "More information" dialog
  (`member/EventDetailModal`), the public `/events/[id]` page and the print
  preview. Each hands in its own `tools` (`member/EventTools`: Share / Print)
  and bottom `actions`. Share and Print need no backend: `ShareModal` opens a
  `mailto:` or copies text (`lib/share.ts`), `PrintPreview` is `window.print()`
  over the `.print-target` CSS. Nested dialogs work because `Modal` only
  answers Escape/Tab when it is the last `[role=dialog]` in the document, and
  the sheets portal to `document.body` — keep both if you add another.
- `components/SavedEvents.tsx` ("All Saved Events") has no fetch of its own:
  it is handed the feed's `savedEvents`, so an un-save there and the Undo on
  its toast show at once. Its dialog is named "All saved events" — the
  sidebar already owns "Saved events".
- There is no public link to a member's saved list; "Share list" is
  `mailto:`/copy of the titles and per-event URLs only. That is a privacy
  decision not yet made, not an omission.

### Admin console (`/host/*`)
- `components/AdminShell.tsx` is the chrome: resolves the session and
  `GET /hosts/me`, then renders `components/host/ConsoleHeader.tsx` — a
  header bar (logo; Analytics, Team and Special access entries, the last
  with a pending-request badge; the person's name over the org's when a
  staff login is signed in; sign out; and for superadmins a segmented Event
  Management / Account Management switch) — over the page. **No sidebar any
  more.** `ConsoleContext` carries `me` (the login) and `org` (the
  organization it acts for): **ownership comparisons read `ctx.org.id`,
  never `session.id`**, which is the person's own login when they're staff.
  The badge count lives there too (`pendingAccess`, `refreshPendingAccess`)
  so a page that decides a request can move it without a reload.
- `/host/team` is the organization's logins: the shared one, each staff
  login, and staff invitations waiting (name + email → `POST /invites` with
  `org_id`; the accept page at `/host/invite/[token]` reads `staff` from the
  preview and creates the login under that org). A superadmin can pick any
  organization. `/host/analytics` is the grant-application numbers: KPI
  tiles, `components/host/WeeklyChart.tsx` (inline SVG, three validated
  categorical hues, crosshair tooltip, a table twin under a `<details>`),
  the per-program table (sortable), a date range (presets + custom; default
  the last 90 days), a superadmin org filter and Download CSV — a plain
  link to `/analytics.csv`, so the browser downloads it with the cookie.
  Console cards and the details page show "N going · M clicks" through
  `components/host/ConsoleCounts.tsx` (`EventOut.click_count`, filled only
  for a signed-in organizer).
- `/host/access` is special access: the org's groups (every org's, for a
  superadmin) beside the chosen group's members on Requests / Approved /
  Declined tabs (Declined also lists revoked). Only Revoke confirms; Archive
  surfaces the API's 409 in the modal. `components/host/AccessPicker.tsx` is
  the form's "Who can see this" — Everyone or a group of the *program's*
  organization (`hostId`), with inline group creation — and
  `components/host/PosterField.tsx` / `PosterSection.tsx` are the printable
  poster (`uploadPoster`, PDF or image) and the details page's QR code. The
  QR encodes the program's public page, never the poster file, and is drawn
  client-side with the `qrcode` package (SVG in the page, PNG on download).
  `Tag kind="access" detail={group}` is the "Special access" pill;
  `EventSummary` draws it in the shared tag row, so console cards and member
  surfaces show the same thing.
- Programs are cards, not table rows: `components/host/PostedEvents.tsx`'s
  `PostedEventCard` (the shared `EventSummary` + "N going" + copy-link) beside
  an accordion `FilterPanel`, with a Your Events / All Events toggle.
  `/host/events/[id]` is a read-only details page (Edit / Un-publish / Copy
  link / Print); `/host/events/[id]/edit` shares `EventForm` with create.
  Accounts stay table-first — `components/AdminTable.tsx` still backs
  `/host/admins` (Organizations) and `/host/users` (Community Members),
  switched by `components/host/AccountsNav.tsx`.
- Dense and staff-first — **deliberately not** the soft one-thing-at-a-time
  member idiom. Staff doing repetitive work want everything one click away;
  don't "harmonize" the two surfaces just because the sidebar went.
- Superadmin-only pages pass `requireSuperadmin` to `AdminShell`, which gates the
  page itself, not just the nav entry. The API refuses regardless.

### Shared
- All HTTP goes through the single `api()` helper in `lib/api.ts`
  (`credentials: "include"` for the auth cookie). Image uploads use raw `FormData`
  via `uploadImage()` — never force `Content-Type: application/json` on those.
  Render errors with `apiMessage(err, fallback)`; `ApiError.message` is the raw
  body, so printing it directly shows people `{"detail": …}`.

## Gotchas / conventions
- **Passwords use `bcrypt` directly — do NOT reintroduce `passlib`** (crashes on
  bcrypt ≥4.1). Hashes are standard `$2b$`.
- **The icon set is the credential** → generate with `secrets` (see
  `app/core/icons.py`), never `random`. Two ordered icons from twelve is 132
  combinations *per name*, which is why the Postgres-backed rate limiting in
  `app/core/rate_limit.py` is load-bearing rather than a nicety.
- **Icon allocation is scoped to the username**, matching the
  `uq_users_username_icons` constraint and the way sign-in resolves a member —
  name first, then credential. Searching globally would run 132 pairs out at 132
  members across all agencies and start refusing accounts for no reason.
- **Sessions are bound to the credential that opened them.** Tokens carry `cv`,
  a fingerprint of the password hash (`security.credential_fingerprint`), and
  `deps` re-checks it on every request. So re-issuing a member's icons or
  resetting an organizer's password ends the sessions opened with the old one
  instead of leaving them live for the week a token lasts. Every place that
  mints a token must pass `cred_hash`, and `/auth/me` must apply the same check
  as the API — otherwise the UI shows a signed-in app where nothing works.
- `JWT_SECRET` has no default — the app fails fast if it's unset.
- DB engine uses `NullPool` + `prepare_threshold=None` for pgbouncer compatibility.
- **Nothing is deleted; things are archived.** Events, members *and organizer
  accounts* carry `deleted_at`, un-saving flips `event_attendees.status` to `removed` rather than
  dropping the row, and the `attendees` relationships deliberately have no
  `delete-orphan` cascade. Attendance counts are what nonprofits put in grant
  applications, so they have to outlive the event and the account. Every read
  path filters `deleted_at IS NULL`; add the filter when you add a query.
- **Saving is a bookmark.** It never registers anyone and never takes a place;
  `events.capacity` is information only. `EventOut.saved_count` ("N going") is
  `null` for signed-out viewers — the public event routes withhold it.
- **Member emails are unique over live rows only** (`uq_users_email_live` on
  `lower(email)`), the same rule as `uq_hosts_email_live`.
- **Special access is per group, not per event.** `access_groups` belong to
  one organization; `events.access_group_id` (null = public) restricts a
  program to members whose `access_memberships` row is `approved`. The rule
  lives in `app/core/access.py`: lists (`GET /events`, the saved list) are
  scoped — anonymous sees public, a member adds their approved groups, an
  organizer adds their own org's restricted programs, a superadmin sees all —
  but **every by-id route serves a restricted program to anyone**, so a link
  or QR code opens and the page can offer "request access". Saving is what
  needs approval (403 otherwise). Memberships are never deleted, they move
  between `requested | approved | declined | revoked`; a declined/revoked
  member re-requesting gets 409 and only the console can let them back in.
  Groups archive (`deleted_at`) and refuse to while live programs use them.
  Member side: `ui/Tag kind="access"` (lock + group name) is drawn by
  `EventSummary`, so every surface carries it; `member/AccessAction` is the
  one control that stands in for Save until `access_status` is `approved`
  (`none` → Request access, `requested` → disabled "Request sent",
  `declined`/`revoked` → "Access not approved"). The public `/events/[id]`
  page is rendered without the viewer's cookie, so `EventActions` re-reads
  the event in the browser to learn their standing, and a signed-out request
  resumes through `/signup?next=…?access=1` the way `?save=1` does. Those
  pages set `robots: noindex`.
- **`lib/accessibility.ts` is the same idea for access needs.** The slugs sit on
  both `events.accessibility_tags` and `users.accessibility_prefs`, and matching
  is string equality, so one list drives the host picker and the member picker.
  Unknown slugs still match and still render (`tagLabel` prettifies them), so a
  tag added straight to the database is not lost — the vocabulary is expected to
  grow. `free` and `no_registration` are marked `derived`: they are written from
  the cost and drop-in answers rather than offered as chips, because asking twice
  is how the two answers end up disagreeing.
- **`lib/categories.ts` `CATEGORIES` is the one canonical topic list.** The signup
  interest chips, the member topic stepper, and the host category picker all read
  it. Interest matching compares a member's interests against `event.category`,
  so a category typed by hand can never match anyone — don't reintroduce a
  free-text category input, and don't start a second list.
- The persisted field is `eye_tracking_enabled` but the hook is
  **`useHeadTracking`** (head pose, not gaze — webgazer was replaced). The column
  name is legacy; don't rename it expecting the hook to follow.

## Roles and admin tiers
- **members** — icon sign-in (`POST /auth/user`) or email + password
  (`POST /auth/signup/user`, `POST /auth/login/user`), the `/` + `/events`
  experience.
- **admins** — hosts with `is_admin = false`. Create and manage only their own
  programs.
- **superadmins** — hosts with `is_admin = true`. Manage any program, plus member
  accounts and other admin accounts. `require_admin` in `app/api/deps.py` gates
  these, and it reads the tier from the DB, not the token.

**Organizations and staff logins share the `hosts` table.** An agency's own
row (`org_id` null) is its shared login and the owner of everything —
`events.host_id`, `access_groups.host_id`, invitations. A **staff login**
(`org_id` set) is one person at that agency with their own name, email and
password; the agency can keep the shared login, add staff logins, or both.
Everything a staff login does is done *as the organization*:
- `org_id_of(host)` in `app/models/host.py` (`host.org_id or host.id`) is
  what **every ownership check** compares against — events create / edit /
  archive / restore, `core/access.py` scoping, access groups, invites,
  analytics. Programs keep `host_id` = the organization;
  `events.created_by_host_id` records which login posted it (attribution,
  not ownership).
- A staff login's tier is its organization's: `Host.is_superadmin` reads
  `org.is_admin` through the relationship, and `deps.load_live_host` loads the
  org alongside the login (and treats a login whose org is archived as
  archived). Use `is_superadmin`, not the `is_admin` column, when deciding
  what a caller may do — the column is meaningless on staff rows.
- Staff join by **invitation**: `POST /invites` with `org_id` + `name` (any
  login of that org may send one, a superadmin for any org; the mail and the
  accept flow are the same as an organization invite), `GET /hosts/team`
  lists the org's logins and pending staff invites, `DELETE /hosts/team/{id}`
  archives one staff login. `GET /hosts` (superadmin) nests `staff` under
  each organization. Staff reset passwords by email like any organizer.

**There is no host signup route.** It existed and was open to the internet;
superadmins now create organizer accounts via `POST /hosts` or by issuing an
invitation (`/invites`), and `/host` is sign-in only. Don't add one back.

## Analytics
`GET /analytics?from=&to=&host_id=` (and `/analytics.csv`, same params) are
the adoption numbers agencies put in grant applications: totals (saves,
unique members who saved, registration-link clicks, programs posted), a
weekly series of the same, and a per-program table (title, first date, org,
saves, currently going, clicks). A plain organizer gets their own org
whatever `host_id` says; a superadmin passes `host_id` or omits it for all.
Weeks are Monday-start in America/Toronto; the default range is the last 90
days. Two counting rules, both deliberate: **saves count every attendance
row created in the range, `removed` ones included** — a save that happened
still happened, and un-saving only flips the status; and **nothing filters
on `deleted_at`** — a program un-published since still counts for what
happened while it was up, and the table marks it `archived`. A repeating
program is one posting (`coalesce(series_id, id)`). Everything is
aggregated in SQL in `app/api/routes/analytics.py`; keep it that way.

## Account recovery
Neither door can be recovered the way a normal login would be, and they work
differently from each other:
- **Members** have no "forgot password" flow — icon accounts have no address,
  and password accounts don't get one either. Recovery for both is a superadmin
  re-issuing the key (`POST /users/{id}/reset-key`) and reading it out; a
  password account is converted to an icon account (its email is released).
  The console's members table lists every key. On the member side, the
  sign-in conflict offers "I forgot my icons" rather than dead-ending, since the
  alternatives ("try again", "I'm new") both fail the member who genuinely can't
  remember — the second by stranding the account they own.
- **Organizers** reset by email (`/auth/host/forgot` → `/auth/host/reset`),
  single-use and expiring in an hour. `forgot` answers identically whether or
  not the address has an account, so it can't be used to enumerate which
  agencies are on the platform — keep it that way, including on the error paths.
  This exists because the sole superadmin previously had no way back in at all.

Two invariants worth knowing before touching `app/api/routes/hosts.py`:
- **Removing an admin archives the account, its programs and its staff
  logins.** `Host.events` cascades `delete-orphan`, so a plain
  `db.delete(host)` would destroy programs members have already saved. It
  used to reassign them to the acting superadmin instead, which kept them
  visible but filed one agency's work under another's name — so both now get
  `deleted_at` and the programs stay attributed to the organization that ran
  them; the org's staff logins are archived in the same statement, since a
  person can't act for an agency that has left. Removing a staff login
  (`DELETE /hosts/team/{id}`) archives just that row. `hosts.email` is unique
  over live rows only (`uq_hosts_email_live`), so an archived account
  releases its address and an agency that left can be invited back under it.
- **A superadmin can't demote or delete themselves — or their own
  organization.** The guards compare the target against both `current.id` and
  `org_id_of(current)`, so a staff login of a superadmin org can't archive or
  demote the org it signs in through. That refusal is what keeps at least one
  superadmin in the system — you can only remove someone else's rights, so
  your own survive. `_superadmin_count` counts organizations only.

## Status
**https://the-belonging-collective.vercel.app is live and public.** Both of the blockers this
section used to list are fixed, and the fixes were dashboard settings, so
nothing in the repo records them — verify against the deployment, not the code:

- SSO protection is scoped to **preview** deployments only, so production is
  reachable without a Vercel login. Preview URLs still 302 to the login wall;
  that is deliberate, don't share one with the agencies.
- `DATABASE_URL` on Vercel uses the **:6543 transaction** pooler, so the
  serverless backend reaches Supabase. `/api/health`, `/api/events` and the
  server-rendered `/events/{id}` all answer 200 against real data.

Re-check with `curl https://the-belonging-collective.vercel.app/api/health` before assuming
either has regressed; a stale "it only runs locally" belief here has already
cost one wrong diagnosis.

**Data.** The 37 real programs from `KWHab_Event_Test_Data.xlsx` are imported as
273 dated occurrences across the six agencies (Extend-A-Family, Karis Disability
Services, WRFN, Independent Living, Developmental Services Ontario, KW
Habilitation). The earlier seeded demo programming is archived, not deleted —
it used four categories (`Advice`, `Arts`, `Hangout`, `Food`) that predate the
real taxonomy and so could never match anyone's interests. Every live event now
carries a category from `CATEGORIES`; keep it that way, and don't un-archive the
demo rows without re-filing their categories first.
