# Product Context — KW Hab Community Calendar

**Purpose of this file.** Everything the product side has told us, distilled once
so it never has to be re-pasted. If a doc listed in §1 shows up again in a
conversation, it is already folded in here — skip it and work from this file.
New material gets appended to §1 with a date, and any requirement it changes gets
updated in §4.

Engineering conventions live in root `CLAUDE.md`; implementation handoff notes
live in `docs/agent-handoff.md`. This file is the **product/requirements** layer.

---

## 1. Sources ingested

| Date ingested | Source | What it contributed |
| --- | --- | --- |
| 2026-08-13 | **Flowchart spec** — "Event Platform — User & Admin Flow Spec" (Section 1 Auth + Event Management, Section 2 Admin Event Management), Mermaid + decision log + gaps list | The intended member flow (anonymous carousel → save vs. register branch), the admin flow (login → tiered list → edit own / create → copy share link), and two decisions: login mandatory iff registration required; track registration-link clicks and saves. |
| 2026-08-13 | **NPO scoping call notes, 2026-08-04** (Teams) | User barriers (literacy, processing, articulation/movement, memory); current tooling; honour-system admin trust; "advertising / directory driving traffic to NPO sites"; what's broken in the current calendar; caregiver behaviour; AI feedback concept; demo feedback (category tags, free/paid separation, searchable by category); registration "later, if adoption"; testing plan. |
| 2026-08-13 | **"KW Hab Community Calendar — Source of Truth"** (consolidated reference, last updated 2026-08-04) | Context on the live calendar, the problem statement, the four user groups, disability/device detail, event structure, the four solution requirements, §5 what's built / what's next / decisions / what wasn't solved / accessibility addressed-vs-untested. |
| 2026-08-13 | **Business goals & success metrics notes** (bulleted, post-call) | Adoption = signups + postings; grant-reporting value of data; member and NPO journeys; NPO approval/onboarding; admin scope; analytics dashboard; success definitions; next steps and owners. |

| 2026-08-14 | **Event Viewing / Admin Event Management PRD** + decision log of 2026-08-09 | Scope by role (members, admin, NPOs). Two things it settles: **metrics are explicitly out of MVP scope**, and NPOs get an **invitation link + onboarding** rather than only superadmin-created accounts. Confirms: separate website, browse without login, save requires a name + icon account, three 45-minute testing sessions with nine testers. |
| 2026-09-27 | **FigJam "KW Habilitation User Flows"** (`XI1XuKznmPt5aePD5Fspen`): Version 1 member flow + decision log, Section 2 admin flow, Section 3 (drag-to-side-panel, guest branch, Google Calendar step), Section 4 onboarding (caregiver vs member, guest browsing, grid vs list), loose decision-log text, and the **Impact Effort Matrix** | The client's final prioritisation. Everything ≥60% impact must be done or planned: onboarding view preference, UX changes (filters, save, date/time), navigation tour, access control, ecosystem support, profile pictures, add-to-calendar, mobile/tablet, recommended events, centralized registration; Feedback (57%) flagged. Also: registration mandatory even for drop-ins (conflicts with §3.1), minimum registration = first + last name, one primary action per card, save framed as a bookmark. Analysis, flow comparison, the Google Calendar answer, conflicts and the phased plan are in `docs/plans/final-iteration-plan.md`; rows touched below carry a "2026-09-27" note. |
| 2026-09-27 | **Figma design file, page "Final"** (`0wXuDItlg03uwYoVqRvDZQ`, node 393:5866): 68 frames — component sheet, Card & List view, Community Member use flow (saved states, drag-left, expanded card, print, share by email, mail templates), Onboarding (member name → email → password, guest, NPO special link), Admin (481/486 current, 404 older) and Super Admin sections | The pixel-level intent behind the board. Adds: a persistent saved sidebar with drag-left, a list view, tag pills and attendee counts on every card, Important Links, share-by-email with HTML mail templates, print previews, a console event-details page, "Un-publish", emailed organizer invites. Conflicts with the record on the member credential (email + password, no icon picker), required email, guest accounts, public counts, share-by-link privacy, multi-person organizations. Indexed in `docs/design/final/README.md` (part files under `_parts/`); folded into `docs/plans/final-iteration-plan.md` §5–§7. |

> Anything below is derived from the above. Where sources conflict, §3 records the
> conflict rather than silently picking a side.

---

## 2. Who this is for

Twelve ministry-funded agencies collaborate under KW Hab; **seven currently post
to the shared calendar**. The live tool is `kwhab.ca/join-us/calendar-of-events/`
— a day/month grid, colour-coded by organization, tagged free/paid/youth, where
clicking an event reveals image, description, PDF attachments, and a
**registration link into that agency's own system**.

| Group | Needs |
| --- | --- |
| **Event goers** — community members with intellectual disabilities | See events quickly, find details easily, **choose for themselves**. Dignity/autonomy is an explicit stakeholder priority, not a nice-to-have. |
| **Parents / caregivers** | Support, sometimes 24/7. Today they often *do the process for* the member rather than *with* them — which is precisely the loss of choice the project exists to fix. Support should fade out as confidence grows. |
| **Event hosts (NPO staff)** | Post events fast. Often no technical skill, no spare time, exhausted. Bad descriptions are a known problem. |
| **Admin (KW Hab)** | Aggregate everyone's events; approve and manage NPO accounts; own the data. |

**Barrier profile — there is no single "accessible user".** Low literacy;
processing (limit how much must be processed at once); articulation/movement
(navigation must be simple); **memory** (passwords, tracking events); sensory
issues with light and sound; limited mobility; dexterity — difficulty with mouse
and keyboard; **"can't type" is called out specifically**; verbal/nonverbal
range. Devices vary widely; some members use pictogram/touch screens to
communicate with staff.

---

## 3. Decisions and open conflicts

**3.1 Registration model — DECIDED 2026-08-13.**

Two independent axes on every event, giving four states and three member
behaviours:

| `registration_mode` | `requires_signup` | Member action |
| --- | --- | --- |
| `internal` | false | **Save.** Drop-in; nothing to register for. |
| `internal` | true | **Register in-platform.** Creates the attendance record; this is the gate. |
| `external` | false | **Save.** Same flow as internal drop-in — the outbound link is informational. |
| `external` | true | **Go to the organizer's site.** Redirect, and the member must be aware they are leaving. Click is tracked. |

Saving stays available in every state; registration is the *additional* action
when required. `registration_url` is required when `registration_mode` is
`external`, and unused otherwise.

This supersedes §5.3.3 of the source-of-truth doc ("in-platform registration
replaces external links") — external is a first-class mode, not a fallback,
because the live calendar's content cannot migrate without it.

**3.2 Admin/organizer registration — DECIDED 2026-08-13.** Internal only. The
superadmin account is fixed; superadmins create the real organizer accounts.
No self-serve host signup, ever. Confirms the current implementation.

**3.3 Copy — DECIDED 2026-08-13.** On the member surface, **the only substantial
text is the event's own content.** Interface copy is minimal — labels, not
explanations. The admin console may carry more text, but it stays simple. This
constrains the "ensure they are aware" requirement in 3.1: the leaving-the-site
signal has to be carried visually and in a few words, not a paragraph.

**3.4 Accessibility scope — DECIDED 2026-08-13.** Build only what is **exclusive
to this platform's functionality**. Anything the browser or OS already provides
is out of scope: text size, contrast, colour, zoom, high-contrast mode. In scope
is everything broken *because* the interaction model is custom — keyboard
handling in the carousel, announcing card changes, the accessibility menu's
semantics, and honouring the OS reduced-motion signal in the JS animation paths.

**3.5 One login per organization — DECIDED 2026-08-13.** An organizer account is
a single shared login for the agency. No `organizations` table, no per-staff
accounts. `Host` stays as credential + org identity + authorization principal.
Accepted trade-offs: no audit trail of who posted what, a shared password that
can't be revoked per person, and no way to off-board one staff member. Revisit
only if an agency asks.

**3.6 Categories are admin-managed — DECIDED 2026-08-13.** The taxonomy moves out
of `lib/categories.ts` into the database with full CRUD. Deleting a category that
has events raises a conflict the admin resolves in a modal: reassign the affected
events to another category, or cancel. Seed list is our best judgement for now.

> **Engineering consequence.** Today a category is a *label string* stored on
> `events.category` and on `users.interest_categories`, and matching is
> string equality (`lib/feed.ts`). Once labels are editable, a rename silently
> breaks every match and a delete orphans members' saved interests. Categories
> therefore need a **stable slug or id** stored on both events and user
> interests, with the label as display-only — and that means migrating the
> existing label-valued rows. This is the real cost of the decision, not the CRUD
> screens.

**3.7 Events are publicly browsable — DECIDED 2026-08-13.** `/events` and the
per-event page are open to everyone. Auth gates only the actions that need an
account: saving, and internal registration. Leaving for an organizer's site is
never gated. A save attempted while signed out must **preserve the intent** —
sign in, then complete the save on the event they were looking at.

**3.8 Deletion — DECIDED 2026-08-13.** Archive, never destroy. Applies to events
and member accounts; attendance rows survive both.
- *Flowchart*: deletion is the elevated, superadmin-only capability.
- *Business notes*: "Admins can create, edit, delete, and reschedule any event"
  (about the KW Hab super user) and "Nonprofits should not be able to edit other
  nonprofits' events" — silent on whether an NPO may delete its own.
- **Working resolution:** NPOs may retire their own events (they need to fix
  mistakes), but as an **archive, not a hard delete**, because attendance numbers
  are grant-reporting evidence and must survive.

**3.6 Hosting.** *(open)* The 08-04 call says "everything self-hosted"; the
current build is Vercel + Supabase. Flag before any infrastructure commitment.

**3.9 FigJam board + Figma "Final" page conflicts — OPEN, 2026-09-27.** The
client's final board and design file disagree with decisions above; none is
resolved here. Twelve decisions, ordered by the work they block, are written
up with options in `docs/plans/final-iteration-plan.md` §5: the member
credential (design draws email + password with no icon picker — vs. A-1/A-3/
R-7); the saved sidebar + drag-left layout (vs. the six wired save paths);
save vs. register as one record; whether topic chips filter or sort (the chip
vocabulary must be `CATEGORIES` regardless); public attendance counts and
their label (also covers "registration mandatory even for drop-ins" — the
data exists, only the counter is missing); what "guest" is (vs. §3.7 and the
attendance FK); a shareable saved-list link (vs. D-7 "with approval");
Important Links vs. the typed `registration_url` (§3.1); per-person organizer
identities (vs. §3.5); member profile pictures (the icon is the password);
mail sender and branding (KW Habilitation vs. The Belonging Collective); and
restricted event sets. The same section lists confirmations that need no
decision: "Un-publish" wording with §3.8's rule kept, the console form keeps
every field the v2 design dropped, the superadmin surfaces keep Users / Access
/ confirmations / Undo, the NPO special link is the invitation.

---

## 4. Requirement register

Status assessed against the code as of **2026-08-20**; rows marked
*2026-09-27* were re-verified against `0449d0f` during the FigJam matrix
analysis (`docs/plans/final-iteration-plan.md`). IDs are stable — cite them in
PRs and discussion. ✅ built · 🟡 partial · ❌ missing.

> Re-assess before trusting a row. The 2026-08-13 pass went stale within days —
> a dozen rows marked ❌ or 🟡 had shipped and the register still said otherwise,
> which is worse than having no register.

### Platform prerequisites

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| P-1 | **Schema changes can reach the live DB** | ✅ | Alembic added; `create_all` on startup removed, `schema.sql` deleted. Baseline revision is idempotent so it is safe against the hand-provisioned Supabase DB with no `stamp` step. |
| P-2 | Attendance data survives event/account changes | ✅ | Events and members archive via `deleted_at`; un-saving flips `event_attendees.status`; the `attendees` relationships dropped `delete-orphan` so a stray `db.delete()` fails loudly instead of erasing history. The DB-level cascade that was the last latent path is closed too — see P-2a. |
| P-2a | FK-level protection for attendance | ✅ | Both `event_attendees` FKs are `ON DELETE RESTRICT` (migration `0015`). A manual `DELETE` against users or events in the SQL editor now fails instead of erasing history, and it covers hosts transitively — `events.host_id` still cascades from `hosts`, so the delete reaches `event_attendees` and is refused there. |
| P-3 | Rate limiting on auth | ✅ | Postgres-backed failure counters on all three sign-in routes (10/15min per identity, 200/15min per IP). Failures only, and success clears the identity key but deliberately not the shared IP key. Account **creation** is still uncapped — see P-3a. |
| P-3a | Cap on account creation | ❌ | `/auth/user` can mint accounts without limit. Any cap low enough to matter risks cutting off a caregiver onboarding a group in one sitting, so it needs a chosen number. |
| P-4 | Feed returns all events | ✅ | The feed pages through `/events?limit&offset` (`app/page.tsx`) until the server stops returning rows, so the 200 cap no longer truncates it. Worth remembering the cap exists when writing any *other* caller — 273 occurrences is already past it. |
| P-5 | Mobile and tablet layouts | 🟡 | *2026-09-27 (71% impact, 95% effort — the largest gap).* The carousel has **no responsive classes at all**: the card is height-led (`EventsView.tsx:1119`) so it overflows a phone's width, the side zones clamp to 96px over it (`EventsView.tsx:1609-1614`), the page is `h-dvh overflow-hidden` (`:882`), the sign-in overlay is a six-column grid in `p-10`. The grid view and signup adapt. `AdminShell` collapses its sidebar (`AdminShell.tsx:183-184`) but the console pages have zero breakpoints (`host/events/page.tsx:179,209`, `PostedEvents.tsx:162,271`). Phase 1, after D-10/D-11/D-12/D-14 and the sidebar decision (plan §5.2) so the chrome is laid out once. Every design frame is 1440 wide; nothing narrower is drawn. |
| P-6 | HTML mail | ❌ | *2026-09-27.* `core/mail.py` is plain-text `smtplib`, used only by organizer password reset. The design's share mails (465:14503, 469:16790) and emailed invites (486:14826) need a multipart path (text + HTML, optional `.ics` attachment, inline logo) and real `SMTP_*` in production — unset still means "logged, not sent". Prerequisite for M-10, M-11, N-10, R-7. Branding and sender are plan §5.11. Phase 1. |

### Accounts & auth

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| A-1 | Member sign-in without email/password | ✅ | Icon key, now **two** icons (`ICON_COUNT`) picked in turn. Genuinely good for the barrier profile. *2026-09-27:* the Figma "Final" onboarding draws name → **required email** → **password** (min 5) and email + password login with no icon picker and no forgot-password (README 06). Direct conflict — plan §5.1, recommendation: keep icons. A dormant `custom_password` path exists in `auth.py:118-165` (min 8) but nothing calls it. |
| A-2 | **A wrong icon tap does not destroy the account** | ✅ | Returns `mode: "conflict"`; creating a second account under an existing name now needs an explicit `create_new`. Note the conflict response is a new username-enumeration oracle — mild, and the reason P-3 mattered. |
| A-3 | Member account recovery | ✅ | `POST /users/{id}/reset-key` (superadmin) issues a new key; the console lists every member's current one. Member-side, the sign-in conflict offers "I forgot my icons" instead of dead-ending between "try again" and "I'm new" — the latter strands the account they own. Staff-mediated by necessity: there is no second factor on a member account to prove anything with, and revealing an icon would cut a 132-combination keyspace to 12. |
| A-4 | Account creation without typing | ❌ | `/signup` gates step 1 on two typed name fields (`signup/page.tsx:159-173`), and so does the in-feed sign-in overlay (`LoginOverlay.tsx:154-168`). "Can't type" is a stated barrier. Steps 2-4 are tap-only and fine. |
| A-5 | NPO staff password recovery | ✅ | Email reset — `/auth/host/forgot` → `/auth/host/reset`, single-use, one-hour expiry, token stored as a hash. `forgot` answers identically whether or not the address exists, so it can't enumerate the agencies. Needs the `SMTP_*` env group to actually send; unset means the link is logged, not mailed. |
| A-6 | ~~Multi-user organizations~~ | — | **Out of scope per §3.5** — one shared login per agency. The residual bug is fixed: removing an organizer now archives the account and its programs together, so the programming stays attributed to the agency that ran it instead of moving to whoever pressed Remove. |
| A-7 | NPO approval before posting | ✅ | Settled by §3.2 — fixed superadmin creates organizer accounts, approval happens off-platform, no self-serve signup. Current implementation is correct. Invitations (`/invites`) now let a superadmin hand over account creation without ever knowing the password. `/host` tells an applicant to ask a superadmin and links to password reset, so it is no longer a dead end. Remaining nice-to-have: forced password change on an account created directly rather than by invitation. *2026-09-27:* the design's "Non-profits only accessible via special link" row (403:15951 → 404:16111 → 404:16160) **is** the invite flow — `/host/invite/[token]` then `/host`. Its 6-digit email-verification step duplicates what the invite link proves; not planned. Its first/last name fields and the superadmin table's several-people-per-agency are §3.5 questions (plan §5.9). Emailing the invite rather than pasting a link is N-10. |
| A-8 | Caregiver-linked accounts (support, not proxy) | ❌ | No user-to-user relation of any kind. *2026-09-27:* the FigJam onboarding flow gives caregivers an **email + password** account with an optional linked member account, and a sticky asks for a member's saves to sync to the caregiver. The email/password half conflicts with A-1 and R-7 — Jesse's call (plan §5.1). The Figma page has no caregiver anywhere, but its mail templates greet `{caregiver_name}`, which has no source without this. Planned as a `care_links` relation between two icon accounts, Phase 2. |
| A-9 | Unlisted programs (hidden from the feed, open by link) | ❌ | *2026-09-27, from the Access Control sticky.* `Event` has no visibility field; every live row is public (`events.py:121-123`). Planned: `events.visibility ∈ {public, unlisted}`, feed and sitemap exclude unlisted, link and `.ics` still work. Phase 1. |
| A-10 | Restricted programs + access requests routed to that organization | ❌ | *2026-09-27.* No member↔organization relation, no request queue. Needs a `memberships` table and a console queue on the org's single login. Scope decision pending (plan §5.12). Phase 2. |
| A-11 | Member profile picture | ❌ | *2026-09-27.* Organizations have logos (`hosts.logo_url`, self-service); members have none. The icons are the password and must not become the picture — and `SavedEvents.tsx:147` currently renders `emojiFor(me.icons[0])`, the first icon of the two-icon credential, as the member's emblem, which should stop regardless (A-11a, Phase 0). The design shows only a coloured avatar circle and "Sophie L." Photo vs. emblem set vs. nothing: Jesse's call (plan §5.10). |

### Discovery

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| D-1 | Filter by interest/category | 🟡 | Interest **sorts**, never filters (`lib/feed.ts`) — a deliberate decision, unchanged. *2026-09-27:* the design's chip row is titled both "EVENT FILTERS" (543:12713) and "SORT EVENTS BY" (399:9447), and its chips (FREE / SPORTS / FOOD / SOCIAL / ART / GAMES / INFORMATIVE) are **not** `CATEGORIES`. Whether topic chips filter (as the member's explicit act) or sort-boost is plan §5.4; the vocabulary is not negotiable (D-1a/D-1b). |
| D-1a | **Admin-managed category CRUD** | ❌ | Per §3.6. New `categories` table + endpoints; `lib/categories.ts` becomes a fetch, not a constant, in the four places that import it. Delete needs an affected-event count and a bulk reassign. |
| D-1b | **Slug-stable category identity** | ❌ | Prerequisite for D-1a — see the note under §3.6. Events and `users.interest_categories` both store labels today; both need migrating to slugs or matching breaks on the first rename. |
| D-2 | Filter by cost | 🟡 | *Re-verified 2026-09-27 — the ✅ was stale.* The filter bar is gone; the carousel says so (`EventsView.tsx:1026-1028`). Cost is a **grouping** in "See events by" (`lib/dimensions.ts:76-85`), which reorders and never removes a card. The API still takes `free=` (`events.py:127`); nothing sends it. Explicit member filters are allowed by the sorting rule — see D-10. |
| D-3 | Filter by organization | 🟡 | *Re-verified 2026-09-27.* Same story: organization is a grouping dimension (`lib/dimensions.ts:60-75`) plus the grid's text search. Not a filter. This is the one axis the old calendar already had and that stakeholders called insufficient. |
| D-4 | Filter by proximity / location | ❌ | `location` is one free-text string. No coordinates, no radius, no map. Stakeholders liked a map-oriented competitor. |
| D-5 | Filter by time / date range | ❌ | No date filter in the member UI. |
| D-6 | Filter by age group / audience | 🟡 | Hosts set `min_age`, `max_age` and `is_youth`. `is_youth` **is** surfaced: `lib/dimensions.ts` buckets programs into a Youth group in the feed's "See events by" picker. `min_age` / `max_age` are collected and never shown, and there is no age *filter* — only a grouping. |
| D-7 | "Who else is going?" / social | ❌ | Attendance is private; no social layer. Stakeholders asked for sharing a calendar with known people, with approval. *2026-09-27:* the board's "centralized registration" sticky (69% impact) asks for "tells the user who is going". Split: **D-7a** a member-facing *count* (`saved_count` is already on `EventOut`; nothing member-side reads it; the design prints "20 Attendees" / "20 People Going" on every card) — Phase 1, display and label pending plan §5.5; names/friends stay ❌ and depend on A-8. |
| D-10 | Visible filters on the member feed (free / paid / this week / organization) | ❌ | *2026-09-27, from the UX Changes sticky (92% impact).* No filter UI on either view; grouping and grid search only. Chips above the stepper/grid, client-side over the already-fetched feed; they are the member's explicit choice, so they may hide cards (personalization still only sorts). Phase 0. Closing this flips D-2/D-3 back to ✅. |
| D-11 | Date **and time** legible on every member surface | 🟡 | *2026-09-27.* The carousel card shows the date only, no start time, at `text-lg` under a 34px title (`FeedParts.tsx:253-273`); the detail modal shows no time either (`EventDetailModal.tsx:97-107`); the grid card has date+time at `text-sm text-muted` (`GridFeed.tsx:55-72`). Only `/events/[id]` shows weekday, date and time. The design shows relative date ("In 7 days"), date and a start–end range on every card. Phase 0. |
| D-12 | Tag pills on every card (Free/Paid · Drop-in/Sign-up · In-person/Virtual) | ❌ | *2026-09-27, from the design's `Tag` component (393:5880).* Nothing renders them; the data (`is_free`, `requires_signup`, `is_virtual`) is on `EventOut` and `lib/dimensions.ts:77-124` already derives the same labels for grouping. Render only. Phase 0. |
| D-13 | "For you this week" recommended set, dismissible | 🟡 | *2026-09-27 (70% impact).* Ranking exists (`lib/feed.ts:18-19,84-89`) but there is no named set, no weekly window, no dismiss. Planned as the first bucket/section, top-N by `matchScore` within 7 days, dismiss persisted on `users.dismissed_program_ids`, never hides from the feed itself. Phase 1. |
| D-14 | List view (rows) as the feed's second mode | 🟡 | *2026-09-27, from the design (393:7397, `Member - Listed Event` 399:6259).* The toggle exists but its second mode is a 3-column grid (`GridFeed.tsx:219`); the design's View Toggle has List and Grid variants and every screen frame uses List. Full-width rows with pills, date/time, location, count, "More information →". Phase 1; O-1's tile is labelled from it. |
| D-15 | Persistent saved sidebar + drag-left | ❌ | *2026-09-27.* Every design card/list frame draws a left panel (count, dashed drop zone, thumbnails, See Saved Events / Google Calendar) collapsing to a rail, with the card dragged **left** (399:9447 mid-drag). The build drags **down** to a bottom `SaveZone`, ArrowDown saves, ↑ opens a full-screen overlay; all six save paths (X-1) and reduced motion (X-7) are wired to that. Decision first (plan §5.2); P-5 mobile waits on it. Phase 2. |
| D-16 | Member labels and confirmations match the design | 🟡 | *2026-09-27.* "Expand" → "More information →"; visible toasts for sign-in and for un-save with Undo (today `aria-live` only, `EventsView.tsx:444, :926`); the detail modal's saved state becomes **Un-Save Event** (today a disabled "Saved ✓", `EventDetailModal.tsx:145`); "See on Map" as a maps search URL. Account chip already shows "First L." Phase 0. |
| D-8 | Accessibility-need matching | 🟡 | Wired at both ends and functional. Hosts tick what a program offers ("What does it offer?"); members pick what they need ("What you need" in the settings menu, not signup — see A-4); `matchScore` scores the overlap. `lib/accessibility.ts` is the single vocabulary for both pickers, taken from what the database already held rather than invented, and it grows after the next focus group. **An access match now outranks a topic match** (5 vs 3): a topic is a preference, a step-free venue is not, and the old weighting put a cooking class up a flight of stairs above a step-free session. Still open: **nothing renders the tags to members**, so the feed silently reorders without saying why — that is the remaining half, deliberately deferred. Also unresolved: whether needs should be allowed to *filter* (they only sort today), which cannot be answered until programs carry the tags that require a human to assert them — `free` and `no_registration` are backfilled from the columns that already imply them (231 and 163 live events), but no live program yet claims step-free access or interpretation. |
| D-9 | Standardized event detail format | 🟡 | Schema is standardized; enforcement is not — see N-1. |

### Registration

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| R-1 | **`registration_mode` + `registration_url`** | ✅ | Both on `Event`; validation shared by create and update, and update checks the merged row. The link is required only in the external+signup state. |
| R-2 | The four registration states drive distinct member behaviour | ✅ | The carousel and the detail modal both branch on `requires_signup` × `registration_mode` now, matching the event page. |
| R-2a | Member knows they are leaving the platform | ✅ | The destination hostname sits under the button — says "you are leaving" more plainly than a sentence about it, and costs four words. |
| R-3 | Browse without an account; save is the gate | ✅ | `/events` is open; `AuthGate` gone. Saving redirects to sign-in carrying the program, and the save completes on return. Accessibility modes work signed-out (session-only); topics and the saved list need an account. *2026-09-27:* the design's sign-in modal adds a three-way chooser (Create an account / Login / Continue as guest) and a guest toast whose header nonetheless shows a signed-in member (404:28235); it also shows an empty saved panel to guests (546:13680). Guest = anonymous is what is built; anything more is R-10 / plan §5.6. |
| R-4 | Un-save | ✅ | Wired in `EventsView`, and re-pressing save on a saved program un-saves it. |
| R-5 | Saves actually persist | ✅ | A failed save rolls the badge back and announces it, instead of claiming a program is saved that the server never recorded. |
| R-6 | Capacity limits | ✅ | `events.capacity`, set in the host form ("Spaces — leave blank for no limit"), enforced in `attend_event` behind a row lock so two people racing for the last place can't both get it. Higher-needs allocation specifically is still not modelled. |
| R-7 | Reminder before the event | ❌ | Members have **no email/phone field at all**. Decided 2026-08-13: contact details are **optional and added after signup**, never required — icon sign-in stays contact-free. Schema is cheap; the mail sender and scheduler are the real cost and can land later. |
| R-8 | Add to Google Calendar / .ics | ❌ | Nothing (grep for `ics`, `text/calendar`, `calendar.google` finds no hit). *2026-09-27:* 75% impact / 6% effort on the matrix — the cheapest high-impact item. Answer to the board's "what is needed from the user?": **nothing** — `GET /events/{id}/calendar.ics` (and `/users/me/events/calendar.ics` for the saved page's list-level button) plus a Google template link, offered on the "Saved!" moment. True two-way sync is ruled out (OAuth, app verification, token storage, and members have no email). The design's "Google Calendar" buttons (sidebar, saved page) have **no prototype arrow** — this defines them; the share mail's promised "link to add the event to their calendar" is the same file. Phase 0. |
| R-9 | Save (bookmark) distinct from register | 🟡 | *2026-09-27.* Today a save on an internal+signup program **is** the registration (`EventActions.tsx:8-13`, `attendance.py:49-136`), and for external programs nothing asks "did you register?" on return. The board frames save as a bookmark with register/calendar as later actions from the Saved panel, and asks "do we really want users to automatically sign-up?". Written up as an `event_attendees.status = registered` split with a Register action in Saved and a self-reported "I signed up on their site". **Not scheduled until Jesse decides** (plan §5.3) — it changes what the grant counts mean. |
| R-10 | Guest registration (no account) | — | *2026-09-27.* Board Section 3 has a "Sign-up as guest → input necessary information" branch. Conflicts with save-is-the-gate (§3.7) and, structurally, with attendance needing a `users` row (`ON DELETE RESTRICT`): a guest is an account with a name and no key. The design adds a "Continue as guest" button and a guest toast under a signed-in header (404:28235). Jesse's call (plan §5.6); not planned. |

### NPO console

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| N-1 | **Mandatory, standardized fields with example text** | ✅ | Name, date, time, location, description, image and activity type are all required and marked; the form says what is still missing rather than failing silently. Description — the known-bad field — is required and up front, with a worked example as placeholder text. |
| N-2 | Edit offers the same fields as create | ✅ | `EditEventModal` is now a thin wrapper around the shared `EventForm` rather than a second implementation, so the two cannot drift apart again, and the free-text category input went with the rewrite. *2026-09-27:* the v2 design draws edit as a page (484:13371); either satisfies this. It also draws a much thinner form (no category, pricing detail, recurrence, capacity, ages, notes, youth, access tags) — keep every field; each has a row depending on it (plan §5 confirmations). |
| N-3 | Can't edit another org's events | ✅ | Enforced in API (403) and UI ("View only"). |
| N-4 | Superadmin can manage any event + accounts | ✅ | With self-demotion/self-deletion guards intact. |
| N-5 | Deletion restricted to superadmins | 🟡 | Half true, and the other half is deliberate. Archiving rather than destroying is done, and `series` means removing a repeating program doesn't leave fifteen dates behind. But `delete_event` depends on `get_current_host`, not `require_admin`: an owner may retire their own program **while nobody has saved it**, and is refused once somebody has. That matches §3.8's working resolution — NPOs need to fix their own mistakes — so the requirement as worded is what's out of date, not the code. Worth re-wording the requirement rather than restricting the route. *2026-09-27:* the v2 design's word is **Un-publish** (486:14236), which is the one word that is true of the archive; adopt it (N-11a, Phase 0) and keep the rule. |
| N-6 | Success confirmation after publish/edit/delete | ✅ | Publishing confirms and hands over a share link, deleting confirms and offers Undo, and editing confirms by name. `UndoToast` only draws the Undo button when there is something to undo — the copy-link confirmation used to offer one that did nothing. |
| N-7 | Copy shareable link on create | ✅ | Copy link on every row plus on the publish confirmation; browser-read origin, prompt fallback. *2026-09-27:* the v2 design's cards carry only View Details and its details page only Edit / Un-publish — no share anywhere. Keep the row icon; add Share and Print to the details page (N-11). |
| N-8 | Reschedule notifies affected members | ❌ | No notification of any kind. |
| N-9 | Important Links on a program | ❌ | *2026-09-27, from the design (483:12966 form, 486:14236 details, 399:8255 modal, 469:16790 mail).* `Event` has `registration_url` and `notes` only. Planned: `events.links jsonb` (`[{label, url}]`, max 3) with the typed registration link kept separate — three untyped links cannot tell the member app which one the four registration states hang off (plan §5.8). Phase 1. |
| N-10 | Organizer invites sent by email | 🟡 | *2026-09-27.* `POST /invites` mints the token but never mails it; the superadmin pastes the link (`admins/page.tsx:288-320`). The design's "Invite New Members — Send Email" (486:14826) needs `core/mail.py` to send it (P-6). The design's form has no organization field; `HostInvite` requires one (§3.5, plan §5.9). Phase 1. |
| N-11 | Console event-details page | ❌ | *2026-09-27.* No console detail view; clicking a card opens the edit modal and another organization's program is an unclickable title (`PostedEvents.tsx:324-335`). The v2 design's View Details → Event Details page (486:14236) with Edit / Un-publish, plus Share and Print per N-7. **N-11a** (Phase 0) is the "Un-publish" wording alone. Phase 1. |
| N-12 | Form parity with the v2 design: end time, description cap, Your/All toggle | 🟡 | *2026-09-27.* `ends_at` is accepted by the API and propagated across a series (`events.py:209-220`) but `EventForm` never asks for it (`EventForm.tsx:386-394`); no 1000-char cap on description on either end; no Your Events / All Events toggle or empty-state Create button (481:5307, 481:6170). Phase 0. |

### Metrics & reach

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| M-1 | Per-event save/signup counts visible to the NPO | 🟡 | Was descoped by the 2026-08-14 PRD; *re-opened 2026-09-27* by the board's "centralized registration: count number of signups" (69% impact). Half exists already: `EventOut.saved_count` (`models/event.py:171-177`) and `ix_event_attendees_event`, but the console shows it only as "N left"/"Full" when a capacity is set (`PostedEvents.tsx:313-320`), and click-throughs (M-2) are recorded but never shown. Phase 0: both numbers on every row, per-org totals for superadmins. The v2 design shows "20 Attendees" on every console card (481:5307) — the number is already computed; the label ("saved" vs "attendees") is plan §5.5. |
| M-2 | Registration click-through tracking | ✅ | Append-only `event_registration_clicks`; `POST /events/{id}/registration-click` is public (anonymous clicks count, `user_id` nullable) and IP-bounded. Recorded before navigating out, and a failure to record never costs the member the link. |
| M-3 | Admin analytics dashboard | ❌ | No route, no endpoint, no charting dep. |
| M-4 | Event postings trend | ❌ | `created_at` exists; nothing aggregates it. |
| M-5 | **Per-event public URL** | ✅ | `/events/[id]`, server-rendered and public. |
| M-6 | SEO / metadata / OG cards | 🟡 | Per-event title/description/canonical, OG + Twitter cards with the cover image, JSON-LD `Event`, `metadataBase`, sitemap, robots, and a favicon (`app/icon.svg`). Still missing: an OG image for pages with no cover. |
| M-7 | Indexable event content | 🟡 | Event pages are in the HTML and in the sitemap, and `/events` is now reachable signed-out. The carousel itself is still client-rendered, so its content isn't in the server HTML — fine while the per-event pages carry indexing. |
| M-8 | Printable poster / weekly list with QR for physical boards | 🟡 | *2026-09-27, from the Stakeholder/ecosystem sticky (78% impact):* word-of-mouth, parent support and physical boards are the channels the platform must complement. A per-program print exists in the console (`PostedEvents.tsx:373-385`, `globals.css:44-59`) — no list, no poster, no QR, and members can't print their saved list ("printing out list" is on the board). The design draws both member print previews (465:14216 list, 471:5101 single event) — client-side `window.print()` over the existing print CSS. Phase 0. |
| M-9 | Share from the member surface | ❌ | *2026-09-27.* Copy-link exists only in the console (`host/events/page.tsx:164-175`). The detail modal and event page have no share control. Web Share API with copy fallback. Phase 0. Share by email is M-10; a shareable list link is M-11. |
| M-10 | Share by email — one event, or the saved list | ❌ | *2026-09-27, from the design (472:12046, 465:14401, templates 465:14503 / 469:16790).* `POST /events/{id}/share {to_email}` and `POST /users/me/events/share {to_email}`: signed-in only, rate-limited per member and per IP, recipient address typed per send and **never stored on the member** (keeps R-7), HTML mail via P-6 with the `.ics` attached (R-8). The templates' `{caregiver_name}` has no source (A-8) — greet by the member's first name only. Branding/sender is plan §5.11. Phase 1. |
| M-11 | Shareable link to a member's saved list | ❌ | *2026-09-27, from the design (465:14401 "Share by Link").* A public URL to a member's saved programs, for a vulnerable population, with no approval step — D-7 recorded "with known people, with approval". If wanted: opt-in token, revocation, expiry, `noindex`, `GET /shared/{token}`. Decision first (plan §5.7). Phase 2. |

### Accessibility

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| X-1 | Many input paths to one action | ✅ | Six routes to save (drag, 2s hold, 1s ArrowDown, button, voice, head-dwell), all through shared handlers. The strongest thing in the build. |
| X-2 | Text-to-speech / voice commands / head tracking | ✅ | All real. TTS↔mic duplex handling is a good detail. |
| X-3 | ~~Text-size toggle~~ | — | **Out of scope per §3.4** — browser/OS zoom already does this. The source-of-truth doc claims it as built; it never existed. Remove the claim rather than build it. |
| X-4 | Keyboard navigation | ✅ | The window-level handler checks `e.target` before acting, so typing in a field or operating a select no longer triggers the feed's shortcuts. |
| X-5 | Screen-reader support | 🟡 | Card changes announce (X-8); the a11y menu dropped the bogus `role="menu"` for `role="dialog"`, closes on Escape and returns focus to its trigger; the sign-in overlay closes on Escape too, and the panels that launch it close on the way out rather than lingering behind it. Still open: the page `<h1>` changes per card. Modals and the Saved panel have correct traps. |
| X-6 | ~~Contrast / colour controls~~ | — | **Out of scope as a feature per §3.4.** Noted for the UI pass only: 7 of 8 category banners fail 4.5:1 with white text, and `pop #FF7A4D` (every error message) is 2.58:1. A palette fix when the design is touched, not a toggle to build. |
| X-7 | Honour the OS reduced-motion signal | 🟡 | In scope — the animations are JS-driven, so the native `prefers-reduced-motion` signal doesn't reach them on its own. Wired in the main paths, and the calibration halo (the one unending animation, on the screen you must hold still for) now holds a steady glow instead of pulsing to 2.6×. Still no `MotionConfig` at the root, so each new animation has to remember on its own. |
| X-8 | Announce card changes | ✅ | A polite live region announces each card as it becomes current — title, date, location, and "n of m" — plus save/un-save outcomes and topic changes. |

### Onboarding *(section added 2026-09-27 from the FigJam matrix)*

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| O-1 | View preference chosen at onboarding and persisted (grid / one-at-a-time; map deferred) | 🟡 | 96% impact. Both views exist and switch live (`MemberChrome.tsx:11`, `EventsView.tsx:138`) but the choice is session state and signup asks about interests only (`signup/page.tsx:200-267`). Map view waits on D-4 (no coordinates). Planned: a two-tile step at signup + in settings, `users.preferred_view`. Phase 1. |
| O-2 | First-run navigation tour ("teach users how to use the platform") | ❌ | 90% impact. No first-run state anywhere; the only teaching is the save bar's "Use ↓ or drag event down". Planned: three pictogram steps, one word each, spoken by TTS when on, skippable and replayable, `users.onboarded_at` (+ `localStorage` signed-out). Constrained by §3.3: labels, not explanations. Phase 2. |

### Feedback *(section added 2026-09-27)*

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| F-1 | Members can say what programs they want, in-platform | ❌ | 57% impact — flagged as borderline, included because the client still wants it and the AI interview was cut on 2026-08-05 only for needing an external API. Nothing in the codebase. Planned no-API first: 👍/👎 "more like this" + optional dictated note on the detail modal and saved panel (never on the card — one primary action), a `feedback` table, a console tab per organization; the conversational interview writes into the same table later. Jesse's board note "what is their current flow for obtaining feedback?" is still open with the client. Phase 2. |

---

## 5. Fixed calendar

- **2026-08-13, 1–7pm** — early-stage concept testing. Groups: people supported,
  family/stakeholders, admin/personnel. Standard 5 participants per group, 2-hour
  blocks.
- **~2026-08-13/14** — target for solution definition; PRDs and wireframes follow.
- **Next session agenda (already agreed):** system flows, NPO approval process,
  login/account structure, multi-user orgs, password recovery.

## 6. Owners / actions outside the codebase

- Draft marketing + onboarding plan for volunteers and caregivers — Justin.
- Email KW Hab to request a homepage link to the calendar post-launch — Justin.
  (Users search for "KW Hab", not for the calendar; this is the top of the funnel.)
