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

**3.10 Five of §3.9's conflicts — DECIDED 2026-09-27**, resolving
`docs/plans/final-iteration-plan.md` §5 items 1–6 and shipped in PRs #46–#51:

1. **Member credential (item 1).** Both, not either: a member chooses an icon
   key **or** email + password, via a switch at sign-in/sign-up
   (`MemberAuthFlow.tsx`). Neither "icons only" (the 2026-08-13 record) nor
   "passwords replace icons" (the Figma draft) — the dormant `custom_password`
   path is now the second door, and a password account still holds an
   allocated icon set for the unique constraint, never shown.
2. **The new designs are the source of truth (items 2, 6, 8).** The persistent
   saved sidebar with drag-**left** supersedes the built bottom-drag zone
   (§3.9's D-15); "guest" means anonymous browsing, not a name-only account
   (§3.9's R-10) — the sign-in chooser's "Continue as guest" just closes the
   door; Important Links sit **alongside** the typed `registration_url`
   (`events.links`, ≤3) rather than replacing it, so the four registration
   states in §3.1 keep the field they hang off.
3. **Saving is only a bookmark (item 3).** No `event_attendees.status =
   registered` split — a save on an internal + `requires_signup` program was
   the registration; now it never takes a place. The capacity gate on save is
   removed accordingly; `events.capacity` is informational only, everywhere.
4. **Filter chips (item 4).** Members can both filter (FREE + `CATEGORIES`
   chips, their own explicit choice) and sort ("For you" / "Soonest" —
   removed 2026-09-28 to match the design, see D-10). The
   vocabulary is `CATEGORIES`, as it always had to be (D-1a/D-1b — admin-
   managed CRUD and slug-stable identity — remain open, unaffected).
5. **Public attendance count (item 5).** "N going", shown only to signed-in
   viewers (`GoingCount`); a signed-out viewer sees "See who else is going" and
   is sent to sign in. The number is `saved_count` — a save, not a separate
   registration — matching decision 3; names/friends stay out per A-8.

**3.11 Four more decisions — DECIDED 2026-09-27 (second batch), shipped in
PRs #53–#56:**

1. **No organization filter on the member feed.** Closes the half of §5 item
   4 (`docs/plans/final-iteration-plan.md`) the first resolution left open:
   topic chips and FREE filter, but not organization. Match the design —
   `FeedFilters` stays as built. The console keeps its own grouping
   (`host/PostedEvents.tsx`'s `FilterPanel`); that half of D-3 was never in
   question and isn't touched by this.
2. **No in-app feedback.** F-1 is declined outright, not merely
   deprioritized — the no-API thumbs-up/down-plus-note design the iteration
   plan sketched for Phase 2 will not be built.
3. **"Unlisted" means special access.** Resolves §5 item 12. A restricted
   program belongs to one organization's `access_groups`
   (`app/core/access.py`, routes in `app/api/routes/access.py`, migration
   `0018`); a member with the link can request access, and one approval
   covers that group's future programs too. This supersedes the plain
   "unlisted (open by link, no approval)" idea A-9 was scoped as — A-9 folds
   into A-10 rather than shipping separately, since the mechanism that
   restricts a program is the same one that routes and answers the request.
4. **Poster QR codes open the event page, not the poster file.** The QR
   (`components/host/PosterSection.tsx`) always encodes the program's public
   `/events/{id}` URL, and appears once an admin attaches a poster via
   `POST /events/posters`. The poster itself is still the agency's own flyer,
   uploaded as-is — there is no platform-generated poster design.

---

## 4. Requirement register

Status assessed against the code as of **2026-09-27**; rows marked
*2026-09-27 (re-verified)* were checked again against `c4d9ce6` once PRs
#46–#51 (the redesign) shipped and Jesse's five decisions (§3.10) landed;
other *2026-09-27* rows are unchanged since the FigJam matrix analysis
(`docs/plans/final-iteration-plan.md`). IDs are stable — cite them in PRs and
discussion. ✅ built · 🟡 partial · ❌ missing · — out of scope/superseded.

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
| P-5 | Mobile and tablet layouts | ✅ | *2026-09-27, shipped (#53).* A reflow, not a redesign, at Tailwind's `sm`/`lg`. Member feed: the saved sidebar becomes a bar under the feed on a phone and stays the drop target for `flyToDrop`; the card stacks image-over-text with the arrows below it and drags on the x-axis only (`touch-action: pan-y`, `EventsView.tsx`); filter chips become one scrolling row; the calibration overlay's text clears a tablet's corner dots. Console: the filter accordion moves behind a Filters sheet below `lg`, search/create stack, cards stack, tables scroll inside a clipped wrapper. `lib/useMediaQuery.ts` drives the few places that swap components rather than classes. |
| P-6 | HTML mail | ❌ | *2026-09-27, re-verified — still plain text.* `core/mail.py` is still plain-text `smtplib`, now used by both organizer password reset **and** invites (N-10, shipped without it). The design's share-mail templates (465:14503, 469:16790) need a multipart path (text + HTML, optional `.ics` attachment, inline logo) that nothing built yet requires — M-10 shipped as a client-side `mailto:` instead of server mail (see M-10), so P-6 is no longer a blocker for it. Still real for a future server-sent M-10/M-11 and for nicer invite mail. Branding and sender are plan §5.11. |

### Accounts & auth

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| A-1 | Member sign-in without email/password | ✅ | Icon key, now **two** icons (`ICON_COUNT`) picked in turn. Genuinely good for the barrier profile. *2026-09-27, resolved (decision 1, §3.10):* both doors are built — a switch at sign-in/up (`MemberAuthFlow.tsx`, `AuthMethod`) offers the icon key or email + password (`POST /auth/signup/user`, `POST /auth/login/user`); the dormant `custom_password` path is now live. A password account still holds an allocated icon set for the unique constraint, never shown. |
| A-2 | **A wrong icon tap does not destroy the account** | ✅ | Returns `mode: "conflict"`; creating a second account under an existing name now needs an explicit `create_new`. Note the conflict response is a new username-enumeration oracle — mild, and the reason P-3 mattered. |
| A-3 | Member account recovery | ✅ | `POST /users/{id}/reset-key` (superadmin) issues a new key; the console lists every member's current one. Member-side, the sign-in conflict offers "I forgot my icons" instead of dead-ending between "try again" and "I'm new" — the latter strands the account they own. Staff-mediated by necessity: there is no second factor on a member account to prove anything with, and revealing an icon would cut a 132-combination keyspace to 12. |
| A-4 | Account creation without typing | ❌ | `/signup` gates step 1 on two typed name fields (`signup/page.tsx:159-173`), and so does the in-feed sign-in overlay (`LoginOverlay.tsx:154-168`). "Can't type" is a stated barrier. Steps 2-4 are tap-only and fine. |
| A-5 | NPO staff password recovery | ✅ | Email reset — `/auth/host/forgot` → `/auth/host/reset`, single-use, one-hour expiry, token stored as a hash. `forgot` answers identically whether or not the address exists, so it can't enumerate the agencies. Needs the `SMTP_*` env group to actually send; unset means the link is logged, not mailed. |
| A-6 | ~~Multi-user organizations~~ | — | **Out of scope per §3.5** — one shared login per agency. The residual bug is fixed: removing an organizer now archives the account and its programs together, so the programming stays attributed to the agency that ran it instead of moving to whoever pressed Remove. |
| A-7 | NPO approval before posting | ✅ | Settled by §3.2 — fixed superadmin creates organizer accounts, approval happens off-platform, no self-serve signup. Current implementation is correct. Invitations (`/invites`) now let a superadmin hand over account creation without ever knowing the password. `/host` tells an applicant to ask a superadmin and links to password reset, so it is no longer a dead end. Remaining nice-to-have: forced password change on an account created directly rather than by invitation. *2026-09-27:* the design's "Non-profits only accessible via special link" row (403:15951 → 404:16111 → 404:16160) **is** the invite flow — `/host/invite/[token]` then `/host`. Its 6-digit email-verification step duplicates what the invite link proves; not planned. Its first/last name fields and the superadmin table's several-people-per-agency are §3.5 questions (plan §5.9). Emailing the invite rather than pasting a link is N-10. |
| A-8 | Caregiver-linked accounts (support, not proxy) | ❌ | No user-to-user relation of any kind. *2026-09-27:* the FigJam onboarding flow gives caregivers an **email + password** account with an optional linked member account, and a sticky asks for a member's saves to sync to the caregiver. The email/password half conflicts with A-1 and R-7 — Jesse's call (plan §5.1). The Figma page has no caregiver anywhere, but its mail templates greet `{caregiver_name}`, which has no source without this. Planned as a `care_links` relation between two icon accounts, Phase 2. |
| A-9 | Unlisted programs (hidden from the feed, open by link) | — | *2026-09-27, superseded (§3.11 item 3).* Jesse: "unlisted" means special access, not a plain visibility flag — there is no `events.visibility` column and none is planned. A restricted program (`events.access_group_id`, migration `0018`) is excluded from public lists and still opens by link or QR to offer "request access". See A-10, the mechanism that now covers this row. |
| A-10 | Restricted programs + access requests routed to that organization | ✅ | *2026-09-27, shipped (#54 migration `0018` + #56).* `access_groups` (per organization) + `access_memberships` (`requested\|approved\|declined\|revoked`), rules in `app/core/access.py`, routes in `app/api/routes/access.py`. A member requests from a restricted program's page (`member/AccessAction.tsx`); one approval covers the group's future programs. `/host/access` lists requests/approved/declined per group with approve/decline/revoke, and a pending-count badge on `ConsoleHeader`. Lists (`GET /events`, saved list) stay scoped to what a member/org/superadmin may see, but every by-id route still serves a restricted program to anyone with the link. |
| A-11 | Member profile picture | ❌ | *2026-09-27.* Organizations have logos (`hosts.logo_url`, self-service); members still have none. The icons are the password and must not become the picture. **A-11a shipped**: `SavedEvents.tsx` no longer renders `emojiFor(icons[0])` — no icon slug appears anywhere outside the sign-in screens. The design shows only a coloured avatar circle and "Sophie L." Photo vs. emblem set vs. nothing is still Jesse's call (plan §5.10), not one of the five decisions in §3.10. |

### Discovery

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| D-1 | Filter by interest/category | ✅ | *2026-09-27, resolved (decision 4, §3.10) and shipped (#49).* Both, cleanly separated: interest still **sorts** ("For you", `lib/feed.ts`'s `matchScore`) and is never hidden by personalization; topic chips in `FeedFilters` **filter** as the member's own explicit act, drawn from `CATEGORIES` (not the design's un-canonical FREE/SPORTS/FOOD/… list). D-1a/D-1b (admin-managed CRUD, slug-stable identity) are unaffected and still open. |
| D-1a | **Admin-managed category CRUD** | ❌ | Per §3.6. New `categories` table + endpoints; `lib/categories.ts` becomes a fetch, not a constant, in the four places that import it. Delete needs an affected-event count and a bulk reassign. |
| D-1b | **Slug-stable category identity** | ❌ | Prerequisite for D-1a — see the note under §3.6. Events and `users.interest_categories` both store labels today; both need migrating to slugs or matching breaks on the first rename. |
| D-2 | Filter by cost | ✅ | *2026-09-27, re-verified — shipped (#49).* The FREE chip in `FeedFilters` (`passesFilters`, `FeedFilters.tsx:9,23-30`) is a real client-side filter over both views, per D-10/decision 4 (§3.10) — it hides cards, unlike the old grouping. |
| D-3 | Filter by organization | — | *2026-09-27, decided (§3.11 item 1).* Jesse: no organization filter on the member feed — matches the design, and `FeedFilters` stays FREE + `CATEGORIES` chips only. `lib/dimensions.ts`'s grouping now backs only the console's `FilterPanel` (`host/PostedEvents.tsx`), which keeps its organization axis. Superseded on the member side, not a gap left to close. |
| D-4 | Filter by proximity / location | ❌ | `location` is one free-text string. No coordinates, no radius, no map. Stakeholders liked a map-oriented competitor. |
| D-5 | Filter by time / date range | ❌ | No date filter in the member UI. |
| D-6 | Filter by age group / audience | 🟡 | Hosts set `min_age`, `max_age` and `is_youth`. `is_youth` **is** surfaced: `lib/dimensions.ts` buckets programs into a Youth group in the feed's "See events by" picker. `min_age` / `max_age` are collected and never shown, and there is no age *filter* — only a grouping. |
| D-7 | "Who else is going?" / social | 🟡 | Attendance is still private by name; no social layer, and names/friends stay ❌, depending on A-8. *2026-09-27, D-7a shipped, resolved by decision 5 (§3.10):* `GoingCount` shows "N going" from `saved_count` to signed-in viewers on every card, the detail modal, `/events/[id]` and the console; a signed-out viewer sees "See who else is going" → sign in (`saved_count` is `null` for anonymous callers). The number is a save count, not a separate registration count (R-9). |
| D-10 | Visible filters on the member feed (free / paid / this week / organization) | 🟡 | *2026-09-27, shipped in part (#49).* `FeedFilters` puts a FREE chip and every `CATEGORIES` topic above both views (card and list), client-side over the already-fetched feed, alongside a "For you" / "Soonest" sort toggle — the member's explicit choice, so it may hide cards (personalization still only sorts). *2026-09-28:* trimmed to the design (`01-feed-card-view`, `02-feed-list-view`) — one EVENT FILTERS row, FREE + topics, nothing else. The sort toggle and the THIS WEEK and For-you chips that had been added were removed; the feed is always the personalised order, and "For you this week" stays a list section plus a card tag. No organization filter, and none is planned — decided against (D-3, §3.11 item 1); the console keeps its own via `FilterPanel`. |
| D-11 | Date **and time** legible on every member surface | ✅ | *2026-09-27, shipped (#49/#51).* The shared `EventSummary` (card, list row, detail modal, `/events/[id]`, console card and details page all use it) shows a relative date, the date and the start–end time as a display-weight line under the title (`ui/EventSummary.tsx:81-101`), via `lib/time.ts:whenLine`. |
| D-12 | Tag pills on every card (Free/Paid · Drop-in/Sign-up · In-person/Virtual) | ✅ | *2026-09-27, shipped (#49/#51).* `components/ui/Tag.tsx`'s `eventTags()` derives the same three pairs from `is_free`, `requires_signup`, `is_virtual` and renders on every surface through `EventSummary` — feed card, list row, detail modal, `/events/[id]`, console card and details page. |
| D-13 | "For you this week" recommended set, dismissible | ✅ | *2026-09-27, shipped (#54 migration `0018` + #55).* `recommendedThisWeek` (`lib/feed.ts`) — up to six programs with `matchScore > 0` starting within 7 days, for a signed-in member with ≥1 interest or need. First section in the list view; "Not for me" writes to `users.dismissed_program_ids` and only removes the card from that section — never from the feed itself. |
| D-14 | List view (rows) as the feed's second mode | ✅ | *2026-09-27, shipped (#49).* `components/member/ListFeed.tsx` replaced the 3-column `GridFeed` (now dead code, unimported): full-width rows sharing `EventSummary` (pills, date/time, location, "N going") and "More information →", with the same `FeedFilters`/sort as the card view. Toggle is Card View / List View (`EventsView.tsx:59-63`). O-1 (persisting the choice) is still open. |
| D-15 | Persistent saved sidebar + drag-left | ✅ | *2026-09-27, shipped (#49) — matches the design.* `components/member/SavedSidebar.tsx` is the left column: a count, a dashed drop zone that tints while a card is dragged toward it, thumbnails, "See Saved Events" and "Add to calendar", collapsing to a rail. The card drags **left** (`DROP_THRESHOLD = 150`, `EventsView.tsx:54`) into `flyToDrop`, which every save path (drag, ← hold, Save button, voice, head-tracking) now calls — the earlier bottom-drag/down-save build described here is superseded. |
| D-16 | Member labels and confirmations match the design | ✅ | *2026-09-27, shipped (#49/#51).* "More information →" (not "Expand"); visible toasts for sign-in and for un-save with Undo; the detail modal's saved state is **Un-Save Event**, not a disabled "Saved ✓" (`EventDetailModal.tsx:80-98`); "Google Maps" opens a maps search URL. Account chip shows "First L." |
| D-8 | Accessibility-need matching | 🟡 | Wired at both ends and functional. Hosts tick what a program offers ("What does it offer?"); members pick what they need ("What you need" in the settings menu, not signup — see A-4); `matchScore` scores the overlap. `lib/accessibility.ts` is the single vocabulary for both pickers, taken from what the database already held rather than invented, and it grows after the next focus group. **An access match now outranks a topic match** (5 vs 3): a topic is a preference, a step-free venue is not, and the old weighting put a cooking class up a flight of stairs above a step-free session. Still open: **nothing renders the tags to members**, so the feed silently reorders without saying why — that is the remaining half, deliberately deferred. Also unresolved: whether needs should be allowed to *filter* (they only sort today), which cannot be answered until programs carry the tags that require a human to assert them — `free` and `no_registration` are backfilled from the columns that already imply them (231 and 163 live events), but no live program yet claims step-free access or interpretation. |
| D-9 | Standardized event detail format | 🟡 | Schema is standardized; enforcement is not — see N-1. |

### Registration

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| R-1 | **`registration_mode` + `registration_url`** | ✅ | Both on `Event`; validation shared by create and update, and update checks the merged row. The link is required only in the external+signup state. |
| R-2 | The four registration states drive distinct member behaviour | ✅ | The carousel and the detail modal both branch on `requires_signup` × `registration_mode` now, matching the event page. |
| R-2a | Member knows they are leaving the platform | ✅ | The destination hostname sits under the button — says "you are leaving" more plainly than a sentence about it, and costs four words. |
| R-3 | Browse without an account; save is the gate | ✅ | `/events` is open; `AuthGate` gone. Saving redirects to sign-in carrying the program, and the save completes on return. Accessibility modes work signed-out (session-only); topics and the saved list need an account. *2026-09-27, resolved (decision 2, §3.10):* the design's three-way chooser (Create an account / Login / Continue as guest) is now built in `MemberAuthFlow.tsx`; "Continue as guest" just closes the sign-in dialog over the already-open feed — guest = anonymous, not a new account type. See R-10. |
| R-4 | Un-save | ✅ | Wired in `EventsView`, and re-pressing save on a saved program un-saves it. |
| R-5 | Saves actually persist | ✅ | A failed save rolls the badge back and announces it, instead of claiming a program is saved that the server never recorded. |
| R-6 | Capacity limits | ❌ | *2026-09-27, re-verified — the ✅ was stale.* Per decision 3 (§3.10), saving is only a bookmark and never takes a place: `attend_event` no longer checks or locks on `events.capacity` (`attendance.py:49-56` — "Capacity is information on the event, not a gate here"). `events.capacity` is still collected and shown ("Spaces") but enforces nothing. Deliberate, not a regression; higher-needs allocation was never modelled either. |
| R-7 | Reminder before the event | ❌ | Members have **no email/phone field at all** required. Password accounts now hold an email (A-1), but nothing reads it for reminders — R-7 was decided 2026-08-13 as **optional, added after signup**, never required, and that still holds. Schema exists for password accounts; the mail sender and scheduler are the real cost and can land later. |
| R-8 | Add to Google Calendar / .ics | ✅ | *2026-09-27, shipped (#46/#49).* `GET /events/{id}/calendar.ics` and `GET /users/me/events/calendar.ics` (`lib/calendar.ts:savedCalendarUrl`); a Google template link (`googleCalendarUrl`) is offered as the "Add to calendar" action on the save toast (`EventsView.tsx:305-318`) and from the saved sidebar. True two-way sync is still ruled out (OAuth, app verification, token storage, and members have no email by default). |
| R-9 | Save (bookmark) distinct from register | — | *2026-09-27, superseded by decision 3 (§3.10).* Rather than splitting `event_attendees.status` into `saved`/`registered`, Jesse settled the underlying question the board raised ("do we really want users to automatically sign-up?") the other way: a save is **only ever** a bookmark, for every registration mode, and never takes a place — `attend_event` no longer checks capacity (see R-6). Nothing on return from an external site asks "did you register?" — not planned. |
| R-10 | Guest registration (no account) | — | *2026-09-27, resolved (decision 2, §3.10).* "Guest" is anonymous browsing, not a name-only account — the sign-in chooser's "Continue as guest" (`MemberAuthFlow.tsx`) just dismisses the dialog over the already-public feed. No guest attendance row, so the FK/recoverability problem this row raised doesn't arise. |

### NPO console

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| N-1 | **Mandatory, standardized fields with example text** | ✅ | Name, date, time, location, description, image and activity type are all required and marked; the form says what is still missing rather than failing silently. Description — the known-bad field — is required and up front, with a worked example as placeholder text. |
| N-2 | Edit offers the same fields as create | ✅ | `EditEventModal` is now a thin wrapper around the shared `EventForm` rather than a second implementation, so the two cannot drift apart again, and the free-text category input went with the rewrite. *2026-09-27:* the v2 design draws edit as a page (484:13371); either satisfies this. It also draws a much thinner form (no category, pricing detail, recurrence, capacity, ages, notes, youth, access tags) — keep every field; each has a row depending on it (plan §5 confirmations). |
| N-3 | Can't edit another org's events | ✅ | Enforced in API (403) and UI ("View only"). |
| N-4 | Superadmin can manage any event + accounts | ✅ | With self-demotion/self-deletion guards intact. |
| N-5 | Deletion restricted to superadmins | 🟡 | Half true, and the other half is deliberate. Archiving rather than destroying is done, and `series` means removing a repeating program doesn't leave fifteen dates behind. But `delete_event` depends on `get_current_host`, not `require_admin`: an owner may retire their own program **while nobody has saved it**, and is refused once somebody has. That matches §3.8's working resolution — NPOs need to fix their own mistakes — so the requirement as worded is what's out of date, not the code. *2026-09-27, N-11a shipped (#50):* the console now says **Un-publish** everywhere (`UnpublishModal.tsx`, the details page, toasts) instead of "delete" — the one word that is true of the archive — and the rule is unchanged. *2026-09-28:* the saved-program guard is gone — the owning organization (any of its logins) may un-publish its own programs whether or not anyone saved them, and a superadmin may un-publish anyone's. Still an archive, still undoable. |
| N-6 | Success confirmation after publish/edit/delete | ✅ | Publishing confirms and hands over a share link, deleting confirms and offers Undo, and editing confirms by name. `UndoToast` only draws the Undo button when there is something to undo — the copy-link confirmation used to offer one that did nothing. |
| N-7 | Copy shareable link on create | ✅ | Copy link on every row plus on the publish confirmation; browser-read origin, prompt fallback. *2026-09-27:* the details page (N-11) also carries a copy-link button and Print, alongside Edit / Un-publish. |
| N-8 | Reschedule notifies affected members | ❌ | No notification of any kind. |
| N-9 | Important Links on a program | ✅ | *2026-09-27, shipped (#46/#50), resolved by decision 2 (§3.10).* `events.links jsonb` (`[{label, url}]`, `LINKS_MAX = 3`), kept separate from the typed `registration_url` so the four registration states in §3.1 still know which link is the sign-up. `EventForm` offers 3 label+URL rows; the console details page, member `EventDetails` and print all render a LINKS list. |
| N-10 | Organizer invites sent by email | ✅ | *2026-09-27, shipped (#46).* `POST /invites` now calls `send_mail` itself (`routes/invites.py:81-96`) — no separate send step — and still returns the token/link so a superadmin can copy it as a fallback if the mail doesn't land. Plain text, not the design's HTML template (P-6, still open). The console form keeps the organization field the design dropped (§3.5, plan §5.9). |
| N-11 | Console event-details page | ✅ | *2026-09-27, shipped (#50).* `/host/events/[id]` (`app/host/events/[id]/page.tsx`) is a read-only page with photo, facts, LINKS, tag pills, "N going", and Edit / Un-publish / Copy link / Print in the header for the owning org or a superadmin; anyone else gets the same page read-only. Edit moved to its own route, `/host/events/[id]/edit`, sharing `EventForm`. N-11a ("Un-publish" wording) is part of the same PR — see N-5. |
| N-12 | Form parity with the v2 design: end time, description cap, Your/All toggle | ✅ | *2026-09-27, shipped (#50).* `EventForm` now asks for an end time; `description` has a 1000-char cap with a visible counter on both ends (`schemas/event.py:55,79`, `EventForm.tsx`); `/host/events` has a Your Events / All Events `SegmentedToggle` (`events/page.tsx:97-112`) with an empty-state Create button. |

### Metrics & reach

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| M-1 | Per-event save/signup counts visible to the NPO | 🟡 | Was descoped by the 2026-08-14 PRD; *re-opened 2026-09-27* by the board's "centralized registration: count number of signups" (69% impact). *Shipped in part (#50):* every console card and the details page now show "N going" from `EventOut.saved_count` (`PostedEventCard`, `host/events/[id]/page.tsx:175`) — the "N left"/"Full" capacity framing is gone, matching decision 3 (§3.10). Still missing: click-through counts (M-2 records them; nothing displays them) and per-org totals for superadmins. |
| M-2 | Registration click-through tracking | ✅ | Append-only `event_registration_clicks`; `POST /events/{id}/registration-click` is public (anonymous clicks count, `user_id` nullable) and IP-bounded. Recorded before navigating out, and a failure to record never costs the member the link. |
| M-3 | Admin analytics dashboard | ❌ | No route, no endpoint, no charting dep. |
| M-4 | Event postings trend | ❌ | `created_at` exists; nothing aggregates it. |
| M-5 | **Per-event public URL** | ✅ | `/events/[id]`, server-rendered and public. |
| M-6 | SEO / metadata / OG cards | 🟡 | Per-event title/description/canonical, OG + Twitter cards with the cover image, JSON-LD `Event`, `metadataBase`, sitemap, robots, and a favicon (`app/icon.svg`). Still missing: an OG image for pages with no cover. |
| M-7 | Indexable event content | 🟡 | Event pages are in the HTML and in the sitemap, and `/events` is now reachable signed-out. The carousel itself is still client-rendered, so its content isn't in the server HTML — fine while the per-event pages carry indexing. |
| M-8 | Printable poster / weekly list with QR for physical boards | 🟡 | *2026-09-27, further shipped (#54 migration `0018` + #56).* Member-side print (#51) unchanged. Console now has poster upload (`POST /events/posters`, `PosterField.tsx`/`PosterSection.tsx`, `events.poster_url`) and a client-side QR (`qrcode` package) that always encodes the public `/events/{id}` URL — never the poster file — downloadable as SVG/PNG and printable, shown once a poster is attached. **Still no generated poster**: what's stored is the agency's own flyer (PDF or image), not a design the platform composes from event data. Still no weekly one-sheet list with a QR. |
| M-9 | Share from the member surface | ✅ | *2026-09-27, shipped (#51).* `components/member/ShareModal.tsx` + `EventTools` put Share on the detail modal, `/events/[id]` and the saved panel — `mailto:` for email, copy-to-clipboard for the link, no Web Share API. See M-10 for the mail path's limits. |
| M-10 | Share by email — one event, or the saved list | 🟡 | *2026-09-27, shipped in a lighter form (#51) than the design (472:12046, 465:14401) called for.* `ShareModal` builds a `mailto:` link (`lib/share.ts:mailtoUrl`) that opens the member's **own** mail app — there is no `POST /events/{id}/share` and no server-sent mail. So there's no rate limit to worry about (nothing is sent server-side), no stored recipient, and no HTML template — P-6 (HTML mail) still only serves organizer mail. The `mailto:` body includes the event, the public link and the Google Calendar link (`lib/share.ts:eventShareText`), which covers the "link to add to their calendar" promise without an attachment. |
| M-11 | Shareable link to a member's saved list | ❌ | *2026-09-27, unchanged — no decision made.* Still no `GET /shared/{token}`; "Share list" in the saved panel is `mailto:`/copy of titles and URLs only (M-10), not a public link. Item 7 of the plan §5 conflicts — neither 2026-09-27 batch (§3.10, §3.11) reached it; D-7's "with approval" concern still stands. Decision first (plan §5.7). |

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
| O-1 | View preference chosen at onboarding and persisted (grid / one-at-a-time; map deferred) | ✅ | *2026-09-27, shipped (#54 migration `0018` + #55).* `users.preferred_view` (card \| list). `EventsView` reads it from `initialMe` when signed in, `localStorage` (`tbc.preferred_view`) when signed out, and PATCHes `/users/me` on every toggle. Map view still waits on D-4 (no coordinates). |
| O-2 | First-run navigation tour ("teach users how to use the platform") | ✅ | *2026-09-27, shipped (#55).* `components/member/Tour.tsx` — three pictogram steps spotlighting `data-tour` targets, one word each, spoken by TTS when on, skippable. `users.onboarded_at` stamps it once (`PATCH /users/me {onboarded: true}`; `localStorage` `tbc.toured` signed-out); "Show me around" in Accessibility Tools replays it. |

### Feedback *(section added 2026-09-27)*

| ID | Requirement | Status | Where it stands |
| --- | --- | --- | --- |
| F-1 | Members can say what programs they want, in-platform | — | *2026-09-27, declined (§3.11 item 2).* Jesse: no in-app feedback. The no-API 👍/👎 + note design sketched for Phase 2 will not be built; nothing in the codebase, and nothing planned. |

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
