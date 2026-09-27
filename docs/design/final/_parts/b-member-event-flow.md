# Part B — "Community Member use flow (Event Page)" (section 435:10560)

Figma file `0wXuDItlg03uwYoVqRvDZQ`, page "Final". 17 frames. Screenshots are
under `docs/design/final/<folder>/<slug>__<node-id>.png`; the folder is the app
screen the frame depicts, not the Figma section.

Code pointers are as of 2026-09-27 (`master` at 0449d0f). Requirement IDs are
from `docs/product-context.md` §4.

## Frames

| Node | Figma name | File | Screen / route | Situation depicted | State type (evidence) | Built today? | New backend? | Conflicts / notes |
|---|---|---|---|---|---|---|---|---|
| 543:12713 | Main Page -> Card View | `01-feed-card-view/card-view__543-12713.png` | `/` carousel — `components/EventsView.tsx`, card in `components/member/FeedParts.tsx` (`WideEventCard`) | Signed-out feed. Header: avatar "Not Logged In", "Accessibility Tools ⌄", Card View / List View toggle. **Persistent left sidebar** "Saved Events / 0 Saved Events" with a Close (chevrons-left) collapse, a dashed drop zone "Saved Events go Here", and two buttons "See Saved Events" and "Google Calendar". Main: "Event 1 of 24", "EVENT FILTERS" chip row (FREE, SPORTS, FOOD, SOCIAL, ART, GAMES, INFORMATIVE), one card with tags FREE / SIGN-UP / IN-PERSON, image, title, "In 7 days · August 28, 2026", time, address, "20 Attendees", buttons "More information →" and "Save event 🔖", two stacked cards peeking below, ↑ / ↓ buttons at right. | Static (resting state, no pointer, nothing highlighted). | **Partial.** Carousel, one-at-a-time, `n of m` announce, keyboard ArrowUp/ArrowDown (`EventsView.tsx:837-844`), view toggle (`member/MemberChrome.tsx:31`), "Expand" button (`FeedParts.tsx:~300`) all exist. Missing: the left sidebar (saved list is a full-screen overlay opened by the drag-up "settings" gesture, `EventsView.tsx:999-1013`; the drop zone is a *bottom* `SaveZone`, `FeedParts.tsx:398`, `DROP_THRESHOLD` drag-**down** `EventsView.tsx:68`); the chip row (`EventsView.tsx:~1030` comment: "No filter bar: the design doesn't have one" — the Final design has one); on-screen ↑/↓ buttons (keyboard/head-dwell only); tags row on the card; "N Attendees" (server sends `saved_count`, `backend/app/schemas/event.py:199`, card doesn't show it); "More information" wording (today "Expand"); Google Calendar. | Google Calendar (see list below). Everything else on the card is already in `EventOut` (`is_free`, `requires_signup`, `is_virtual`, `saved_count`, `starts_at/ends_at`, `location`). | Chip labels SPORTS / FOOD / SOCIAL / ART / GAMES / INFORMATIVE are not `CATEGORIES` (`lib/categories.ts`: Education, Social, Recreation, Support Group, Cooking, Fundraising, Youth Programs, Wellness, Fitness, Arts & Crafts, Music, Games, Sports). FOOD≈Cooking, ART≈Arts & Crafts, INFORMATIVE≈Education — but a hand-typed label can never match (§3.6, D-1b). "EVENT FILTERS" heading vs 399:9447's "SORT EVENTS BY 0 FILTERS" for the same row — the two frames disagree on whether chips **filter or sort**; "personalisation sorts, never filters" (D-1) means the SORT reading is the compatible one; FREE is a cost filter and may filter (D-2). "20 Attendees" publishes a per-event count that D-7 keeps private today (it's an aggregate of saves, not names — probably fine, but it is a product call and the label overstates: a save is not attendance). The date under the card ("October 24") vs card ("August 28") is placeholder noise. |
| 399:9447 | Main Page -> Card View: SAVED HOVER | `01-feed-card-view/card-view-saved-hover__399-9447.png` | `/` carousel — `EventsView.tsx` drag handlers `:1135-1180` | Member is **dragging the card toward the left sidebar**: card lifted, rotated ~-4°, drop-shadowed, overlapping the panel; the dashed drop zone is filled light-blue and its label changed to "Drag events here"; "Save event" button on the card shows a pressed/highlighted fill. Row heading now reads "SORT EVENTS BY 0 FILTERS". | Mid-animation (card rotated + displaced mid-drag; drop zone in its active tint; label swapped). | **Partial.** Drag-to-save exists with `whileDrag={{ scale: 1.03 }}` and an `active` drop-zone highlight (`FeedParts.tsx:398`), but the gesture is **drag down** to a bottom zone, not drag **left** to a sidebar, and there is no rotation. Changing the drop direction touches `onDrag`/`onDragEnd` (`EventsView.tsx:1140-1180`), the fly-to-target animation (`dropRef`), hold-to-save's shrink target (`:531`), and the up/down key mapping (ArrowDown currently *saves*, `EventsView.tsx:837`; the design's ↓ is *next card*). | None. | X-1/X-7: any new drag/rotate animation must still honour reduced-motion. Direction change conflicts with the six-input-paths invariant only if the drop tab/hold path is not moved together with it. |
| 399:9643 | Main Page -> Card View: SAVED | `01-feed-card-view/card-view-saved__399-9643.png` | `/` carousel, saved state | After the drop: sidebar now lists saved thumbnails (image, title, date); card's right button is a **grey disabled "Event Saved 🔖"**; the "More information →" button unchanged; ↑ ↓ arrows present. Sidebar header still says "0 Saved Events" (placeholder bug). | Static (post-save resting state; disabled button is a state, not a transition). | **Partial.** Saved state renders as "Saved ✓" text (`FeedParts.tsx:311`) and the `SaveZone` count badge; re-pressing save un-saves (R-4, `EventsView.tsx toggleSave`). Sidebar thumbnails: missing (list only in the overlay). | None. | Design gives no un-save on the card itself (disabled button) — un-save moves to the More Information modal (461:11216). Today the card is the un-save path; keep one or the other, not neither. |
| 399:8255 | Main Page -> More Information | `03-event-details/more-information__399-8255.png` | Detail modal — `components/member/EventDetailModal.tsx` (also `/events/[id]` + `components/EventActions.tsx`) | Expanded card over a blurred **list/grid** feed ("SEE EVENTS BY Non-Profit Or…", "Today | Wednesday…"). Tags FREE / SIGN-UP / IN-PERSON; top-right **"Share ✈" and "Print 🖨"**; image left; title; "In 7 days · Aug 28"; time; address; "20 Attendees"; **DETAILS** paragraph; **LINKS** list ("Hyperlink to whatever the NPO would like" ×2 with paperclip); footer **"See on Map 🗺" + "Register for Event ↗"**; round × outside the panel top-right. This is the *external-registration* variant (arrow-out icon). | Overlay-modal (blur backdrop, panel, external close). | **Partial.** Modal exists with backdrop, external ×, Escape, focus trap; shows image, title, date, location, description, notes, and branches on `requires_signup × registration_mode` ("Sign up on their site ↗" / "Save Event", `EventDetailModal.tsx:46-151`). Missing: tags row, time range, attendee count, Share, Print, See on Map, LINKS section. `/events/[id]` page already covers R-2a (hostname under the button). | **LINKS** — no field: `Event` has `registration_url` and `notes` only (`backend/app/models/event.py`). Needs `links: [{label,url}]` (JSONB) + host form UI + validation. **Share** and **Print** — see 472:12046 / 471:5101. "See on Map" — none needed if it opens a Google Maps search URL for the free-text `location` (D-4: no coordinates). | Copy: "See on Map" is fine; "DETAILS"/"LINKS" are labels (§3.3 OK). Modal drawn over the *list* view but arrows come from the *card* view — same component either way. |
| 469:15593 | Main Page -> More Information | `03-event-details/more-information__469-15593.png` | Same modal | Identical to 399:8255 except footer right is **"Save Event ⬇"** (internal / drop-in variant). | Overlay-modal. | **Partial** (same as above; the Save branch exists, `EventDetailModal.tsx:143-151`). | As 399:8255. | Save icon is a *download* arrow, not the bookmark used on the card — inconsistent affordance for the same verb. |
| 461:11216 | Main Page -> More Information | `03-event-details/more-information__461-11216.png` | Same modal, saved state | Identical layout; footer is **"Google Maps 📍" + "Un-Save Event ⊠" (red outline)**. Reached from a saved thumbnail (sidebar) or a saved-list card. | Overlay-modal (static saved variant). | **Missing** in the modal: when `saved`, the button is just disabled "Saved ✓" (`EventDetailModal.tsx:145`). Un-save exists elsewhere (`GridFeed.tsx:93-95` "Remove …", and re-press on the carousel), and the API is `DELETE /events/{id}/attend` (`backend/app/api/routes/attendance.py:139`) which flips status to `removed` — archive, not delete, so the design's un-save is compatible with §3.8. | None (endpoint exists). | Frame is a *detached* copy (children are 461:*), whereas 399:8255/469:15593 are instances of the "Expanded Card" component — treat 461:11216 as the source of truth for the saved variant, but the component should grow a `saved` variant rather than a fork. "Google Maps" vs "See on Map" — same button, two labels. |
| 399:10360 | Main Page -> See Saved Events: EVENTS PRESENT | `04-saved-events/see-saved-events-present__399-10360.png` | Saved list — `components/SavedEvents.tsx` | **Full page, not a panel**: header with Card View / **Grid View** toggle; "← All Saved Events (10)"; search field; buttons **Google Calendar / Share list ✈ / Print list 🖨** (Print highlighted); tabs **Upcoming Events | Past Events** (Past selected); three portrait cards ("20 People Going"); footer **← Back / Next →** pagination. | Static, but "Print list" is drawn pressed (Hover-focus on that one control) — the arrow at 10640,637 leaves from it to the print preview. | **Partial.** `SavedEvents.tsx` is an overlay (`role=dialog`, `:150-160`) with the member's icon in the title, search when signed in (`:167`), sections Upcoming / per-category / Past all on one scroll (`:211-240`), `GridCard` with open + remove. Missing: page-level route/back arrow, Upcoming/Past as tabs, pagination, Google Calendar, Share list, Print list. | Share list + Google Calendar (see list). Print list: none. | Uses the older 3-column "Saved Event Card" component (399:10657); **superseded** by 468:14558's 2-column card for layout, but this frame is the only one showing the tabs+pagination footer. "People Going" here vs "Attendees" elsewhere for the same `saved_count`. Cards under the *Past* tab still say "In 7 days" (placeholder). |
| 469:15302 | Main Page -> See Saved Events: EVENTS PRESENT | `04-saved-events/see-saved-events-empty-signed-out__469-15302.png` | Saved list, empty, signed out | "← All Saved Events (0)"; centred "You don't have any saved events yet!" / "Login to start saving events." / **[Login]**. | Static (empty state). | **Built** — `SavedEvents.tsx:181-193` ("Sign in to keep events" + Sign in) which also hands the intent to `LoginOverlay`. Copy differs. | None. | Name says EVENTS PRESENT; it is the empty/signed-out state. "Login to start saving events." is a sentence of explanation on the member surface (§3.3) — borderline. |
| 469:15499 | Main Page -> See Saved Events: EVENTS PRESENT | `04-saved-events/see-saved-events-empty__469-15499.png` | Saved list, empty, signed in | Same as 469:15302 but the button is **[Browse Events 🔍]**. | Static (empty state). | **Built** — `SavedEvents.tsx:326-342` `EmptyAll` ("No saved events yet / Programs you save show up here."); no Browse button — closing the overlay is the equivalent. | None. | Sub-line still reads "Login to start saving events." although this is the signed-in variant — copy bug in the design. |
| 468:14558 | Main Page -> See Saved Events: EVENTS PRESENT | `04-saved-events/see-saved-events-present-list__468-14558.png` | Saved list | As 399:10360 but **Grid View** selected in the header, and the cards are the newer **2-column landscape card** ("Open Space: Coffee & Chats", "20 Attendees"); grid continues below the fold; no pagination footer visible. | Static. | **Partial** (as 399:10360; the 2-col landscape card is closer to today's `GridCard` than the 3-col one). | As 399:10360. | **Current** iteration of the list body (its card children are 471:*/472:* — created after the 471/472 print frames — while 399:10360 still instances the older 399:10657 card). |
| 491:11595 | Main Page -> See Saved Events: EVENTS PRESENT | `04-saved-events/see-saved-events-present-list__491-11595.png` | Saved list | Same 2-column grid **without the app header, back arrow or Upcoming/Past tabs** — just "All Saved Events (10)", search, the three action buttons and the grid. Highest node id in the section. | Static; reads as the scrolled state or a content-only variant of 468:14558. | As 468:14558. | As 399:10360. | Because the header, back arrow *and* tabs are gone it is ambiguous whether this is (a) the page scrolled, (b) the tabs being dropped, or (c) the print/email body. Open question for the designer; do not build from this one alone. |
| 465:14216 | Main Page -> See Saved Events: EVENTS PRESENT | `05-print-and-email/saved-events-print-preview__465-14216.png` | Print preview modal over the saved list | Blurred saved page (Print list pressed); modal with light-blue header "👁 Printing Preview", title **"List of Sam's Events"**, a divider-separated list of events (image, tags, title, date, time, address, attendees), footer **Cancel / "Print List 🖨"**, × outside. | Overlay-modal. | **Missing** on the member side. The pattern exists in the host console: `.print-target` / `.no-print` in `frontend/app/globals.css:44-60` and `window.print()` in `components/host/PostedEvents.tsx:376-384`. | **None** — client-side `window.print()` with a print stylesheet. Data is already in `GET /users/me/events` (`attendance.py:168`). | The preview is a custom modal, not the browser print dialog; the browser dialog still follows. Name still says "See Saved Events". |
| 471:5101 | Print Individual Event | `05-print-and-email/print-individual-event__471-5101.png` | Print preview modal for one event | Same "Printing Preview" modal; **heading still says "List of Sam's Events"** but the body is one event (image, title, date, time, address, attendees, DETAILS, LINKS); footer **Cancel / "Print Event 🖨"**. Background is the *saved list* page although both arrows into it come from the *More Information* modal. | Overlay-modal. | **Missing** on the member side (host side prints a card via `.print-target`). | **None** — client-side; the per-event page `/events/[id]` (server-rendered) is the natural print target. LINKS needs the new `links` field to print. | Heading is a copy-paste error ("List of Sam's Events" for a single event). Since this opens from More Information, the backdrop should be the feed, not the saved list. |
| 465:14401 | Modal Card | `05-print-and-email/modal-share-by-email-or-link__465-14401.png` | Share-list modal (from the saved page's "Share list") | "Share list of events?" with ×; **Share by Email** [Enter Email] **[Send ✈]**; **Share by Link** [Https//SamKWEventslist] **[Copy Link ⧉]**. | Overlay-modal. | **Missing.** No member-side share at all; `components/CopyLinkButton.tsx` is the host console's per-event link. | **Yes, two things.** (1) `POST /users/me/events/share` `{to_email}` → server-sent HTML email of the member's saved list (template 465:14503) via `app/core/mail.py` (plain-text `smtplib` today; needs HTML + inline images/logo + a real `SMTP_*` config in prod). (2) A **public, tokenised URL for a member's saved list** — new column/table (`users.share_token` or `saved_list_shares`), `GET /shared/{token}` (public, `deleted_at` filters), and a page to render it. Both need the Postgres rate limiter (`app/core/rate_limit.py`) — an unauthenticated or lightly authenticated "email anyone" endpoint is an open relay with KW Hab branding. | Node's hidden children ("Account", "Roles", "You're not logged in!", "Create an account to save events…") show this is a **repurposed sign-up modal**; the text node names are stale. Share-by-link makes a member's saved programs readable by anyone holding the URL — members are a vulnerable population, D-7 recorded "sharing … with known people, with approval". Needs opt-in creation and revocation, never a default URL. |
| 472:12046 | Modal Card | `05-print-and-email/modal-share-list-of-events__472-12046.png` | Share modal for **one event** (from More Information's "Share") | "Share list of events?" with ×; **"Enter Email of Recipient"** [Enter Email] **[Send ✈]**. No link option. | Overlay-modal. | **Missing** (member side). The host console has a Share icon on `PostedEvents.tsx:387` — that is copy-link, not email. | `POST /events/{id}/share` `{to_email}` → email template 469:16790. Same mail/HTML/rate-limit work as above. Copy-link for one event needs nothing: `/events/[id]` is already public (M-5). | Heading says "list of events" for a single event — copy bug. Oddly the *single-event* modal has no Copy Link even though a public URL already exists; the *list* modal has one even though no such URL exists. |
| 465:14503 | Event list email template | `05-print-and-email/event-list-email-template__465-14503.png` | Outbound email (no route) | KW Habilitation logo header; "Hi {caregiver_name}, / {Community member name} sent you a list of Events using the KWEvents tool!"; four event rows (image, title, date, time, address, "20 Attendees"); button **"View Events on our Platform ↗"** (arrow 469:15231 leads back to the saved-events page). | Static (email). | **Missing.** | HTML mail template + sender (above). `{caregiver_name}` **cannot be filled**: the modal collects only an address, and there is no caregiver relation (A-8 missing) or recipient-name field. `{Community member name}` = `first_name`. | Branded "KW Habilitation" / "KWEvents tool", not the platform name and not the member's own agency; the six agencies would all send as KW Hab. Member contact details stay optional (R-7): this design only needs the **recipient's** address, typed per send, so it does *not* require an email on the member — compatible, provided the address is not persisted on the user. |
| 469:16790 | Event list email template | `05-print-and-email/event-list-email-template__469-16790.png` | Outbound email (no route) | Same header; "{Community member name} sent you a list of Event from the KWEvents platform."; **one** event with DETAILS paragraph and two LINKS rows; no button. | Static (email). | **Missing.** | As above plus `links`. | "a list of Event" — copy for the single-event send is a find-and-replace leftover. No link back to the platform on this one, unlike the list template. |

Frames not in my slice but whose subtree I checked for iteration order:
431:13693 (saved panel with an "… was unsaved." toast) and 429:13451 (empty
state) are the earlier **panel** treatment with a Close ×, "All Saved Events"
and "Upcoming Events" heading; 446:13000 is the same panel with "Row of Events".
The section's 399:10360 → 468:14558 turn the panel into a **page** with a back
arrow, tabs and Share/Print. So: panel = superseded, page = current.
399:11385 / 404:28474 are earlier More Information instances over the list view
(same "Expanded Card" component); 404:28717 places a login "Modal Card" over
the list, which is the modal that 465:14401 was later repurposed from.

## The member flow, as the prototype arrows draw it

1. **Card View** (543:12713). Member lands signed out; sidebar shows 0 saved
   and a dashed drop zone. Chips row (FREE + six topics) above one card.
2. **Read more** — "More information →" (arrow 443:11247) opens the **More
   Information** modal (399:8255 external-signup variant / 469:15593 save
   variant) over the feed.
   - From the modal, **Share** (472:12086/12087) → single-event share modal
     (472:12046) → **Send** (472:12085) → single-event email (469:16790).
   - From the modal, **Print** (472:12088, 471:5393) → Print Individual Event
     preview (471:5101) → Cancel / Print Event.
3. **Save** — drag the card **left** into the sidebar (399:9447 mid-drag, drop
   zone tinted "Drag events here") → card shows "Event Saved" and the sidebar
   lists the thumbnail (399:9643). (The design assumes the member is signed
   in by now; R-3 sign-in-then-complete-the-save is not drawn in this section.)
4. **A saved thumbnail** in the sidebar (461:11552) opens More Information in
   its **saved** variant (461:11216): Google Maps + **Un-Save Event**.
5. **"See Saved Events"** (sidebar button, 469:16788/16789/446:12657):
   - with 0 saved → empty page, "Browse Events" (469:15499) or "Login"
     (469:15302);
   - with saves → **All Saved Events** page (399:10360 → 468:14558 current),
     search, Upcoming | Past tabs, Back/Next.
6. On the saved page a **card** (465:13682) opens the saved More Information
   (461:11216) again.
7. **Print list** (465:14367) → print preview (465:14216) → Cancel / Print List.
8. **Share list** (472:12092/12093) → share modal (465:14401): Send by email or
   Copy Link. **Send** (468:15229) → list email (465:14503); the email's
   "View Events on our Platform" (469:15231) and the modal's Send (469:15230)
   both return to the saved page.
9. **Google Calendar** appears on the sidebar and the saved page but has no
   arrow anywhere — undefined behaviour.

### About the arrow named "Button w --> Subject: Extend-a-family - Create your password to start learning!"

Connector 468:15229 starts at the share modal's **Send** button
(465:14401, x≈12384-12568, y≈1888-1939) and ends at the **Event list email
template** (465:14503, x 12827). No frame named "Subject: …" exists anywhere on
the page (grep of all 6,862 lines finds only the connector). Figma names a
connector after its endpoints at creation and does not rename it when the
target frame is renamed, so the target frame was **originally** a mail titled
"Subject: Extend-a-family - Create your password to start learning!" and was
later reworked into the event-list email. The "start learning" wording and
"Create your password" do not fit this product at all — it reads like an
onboarding/password-set email pasted from another project (an LMS) and
re-skinned with the Extend-A-Family name.

What it implies, and how it sits against the record:
- As drawn today, the email is **outbound to a third party** (a caregiver) at
  an address the member types per send. That needs an SMTP sender and an HTML
  template but **not** a member email address, so it is compatible with the
  decision that member contact details are optional and never required (R-7)
  and with the icon key being the whole credential (A-1) — *as long as the
  typed address is not saved onto the user*.
- The **residue** — "Create your password" — is the incompatible reading: an
  email to the *member* inviting them to set a password presupposes members
  have emails and passwords. That contradicts the icon-key model and the
  contact-details decision, and there is no frame left that shows it. Treat it
  as abandoned unless the client says otherwise; worth one question on the
  Aug/Sept call, not a build.
- `{caregiver_name}` in both templates presupposes a caregiver **relation**
  (A-8, missing) or at least a name field the modal does not collect.

## New backend work implied

1. **`events.links`** — list of `{label, url}` (JSONB), on `EventCreate`/
   `EventUpdate`/`EventOut`, host form field, URL validation. Drives the LINKS
   section in the modal, print and email. (No existing column fits:
   `registration_url` is the registration gate, `notes` is free text.)
2. **Share one event by email** — `POST /events/{id}/share {to_email}`;
   HTML mail (image, logo, links) built server-side; `app/core/mail.py` is
   plain-text `smtplib` and only ever used for password reset, so it needs an
   HTML/multipart path and prod `SMTP_*` (today unset in prod means "log it").
   Rate-limit per user *and* per IP with `app/core/rate_limit.py`; decide
   whether signed-out visitors may send (they can share a public URL for free
   already — recommend auth required).
3. **Share the saved list by email** — `POST /users/me/events/share
   {to_email}`; same sender; data from the existing `my_events` query.
4. **Share the saved list by link** — new token (per user or per share),
   public `GET /shared/{token}` returning the saved list with `deleted_at`
   filters, a `/shared/[token]` page, and revocation. Must be opt-in; the
   "View Events on our Platform" button in the email should land here.
5. **Google Calendar** — cheapest: per-event Google Calendar template URL
   (client-side, no backend). The sidebar/list-level button implies the whole
   list, which needs either an **ICS feed** endpoint keyed by a token (Google
   can subscribe to it) or OAuth sync (out of proportion). R-8.
6. **Nothing for print** — client-side `window.print()` with the existing
   `.print-target` stylesheet.
7. **Nothing for attendees/tags/time** — already on `EventOut`.

Not backend, but sizeable frontend: sidebar layout + drag-left drop target,
chip row, Upcoming/Past tabs with pagination, print preview modals.

## Conflicts / open questions

- **Filter vs sort.** The same chip row is titled "EVENT FILTERS" (543:12713)
  and "SORT EVENTS BY 0 FILTERS" (399:9447/9643). Recorded decision: interests
  sort, never filter; only cost/organisation filters remove cards. FREE may
  filter; the six topic chips should sort (or the decision is reopened).
- **Chip vocabulary ≠ `CATEGORIES`.** SPORTS/FOOD/SOCIAL/ART/GAMES/INFORMATIVE
  vs the thirteen canonical labels. Either the chips render `CATEGORIES`
  (D-1a/D-1b make them data anyway) or the taxonomy changes — not both lists.
- **Drag direction.** Design drops **left** into a sidebar; build drops
  **down** into a bottom zone, and ArrowDown = save. The design's ↓ button is
  "next card". Every one of the six save paths (X-1) and the reduced-motion
  handling (X-7) is touched by this.
- **Un-save moves off the card** into the modal's "Un-Save Event". Fine
  (archive semantics already, `status=removed`), but re-press-to-unsave on the
  card should stay or the modal path must be built first — never neither.
- **Public attendance count.** "20 Attendees" / "20 People Going" exposes
  `saved_count`. Aggregate only, but D-7 recorded attendance as private and
  the label overstates (saves ≠ attendance). Product call.
- **Copy.** "Login to start saving events." on the signed-in empty state;
  "Share list of events?" and "a list of Event" on single-event share; "List
  of Sam's Events" on the single-event print preview; "See on Map" vs "Google
  Maps"; "Attendees" vs "People Going"; "List View" (feed) vs "Grid View"
  (saved page) for the same toggle. All small, all §3.3-compatible once fixed.
- **Email branding and sender.** Templates are KW Habilitation-branded and say
  "KWEvents tool/platform". If all six agencies' members send through it, the
  From/branding is a client decision; the `MAIL_FROM` mailbox is one agency's.
- **`{caregiver_name}`** has no source. Either the modal collects a name or the
  greeting drops it. A-8 (caregiver links) is still ❌.
- **Share-by-link privacy.** A URL to a member's saved programs, for a
  vulnerable population, with no approval step — D-7 asked for "with
  approval". Needs opt-in token creation, revocation, and no indexing.
- **Stale password email.** The connector name is the only trace of a
  "Create your password" email to members. Contradicts icon-key auth and the
  optional-contact decision; confirm it is dead.
- **Google Calendar has no arrow** — behaviour undefined; scope before building.
- **Sign-in-preserves-intent (R-3)** is not drawn in this section; the SAVED
  frames still show "Not Logged In" in the header while listing saved events.
