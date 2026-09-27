# Figma "Final" page — frame index

Figma file `0wXuDItlg03uwYoVqRvDZQ`, page **Final** (node `393:5866`):
<https://www.figma.com/design/0wXuDItlg03uwYoVqRvDZQ/?node-id=393-5866>.
Screenshots are palette-compressed PNGs named `<slug>__<node-id>.png`.
Catalogued 2026-09-27 against `master` at `0449d0f`. The four part files carry
the full per-frame notes; this index is the map.

- [`_parts/a-feed-saved-components.md`](_parts/a-feed-saved-components.md) — component sheet, Card & List view, loose Saved / More Information frames
- [`_parts/b-member-event-flow.md`](_parts/b-member-event-flow.md) — "Community Member use flow": saved states, drag-left save, expanded card, print, share by email, mail templates
- [`_parts/c-onboarding-auth.md`](_parts/c-onboarding-auth.md) — member sign-up (name → email → password), guest, NPO special-link row
- [`_parts/d-admin-console.md`](_parts/d-admin-console.md) — admin console: sections 481/486 are current, 404 is older

## How to read this

**Frame naming.** Figma names frames `Screen -> Situation: STATE`, e.g.
`Main Page -> Card View: SAVED HOVER`. The folder here is the *app screen* the
frame depicts (00–10, then 99-superseded), not the Figma section it sits in —
several sections mix screens and iterations.

**State type legend**

| State | Meaning |
| --- | --- |
| Static | A resting state: nothing mid-gesture, no overlay, no toast |
| Mid-animation | Something is in motion (a card mid-drag, a zone mid-tint) |
| Hover-focus | A control drawn in its hover/pressed/alternate fill |
| Overlay-modal | A dialog over a blurred page |
| Transient | A toast or confirmation that disappears on its own |

**Other columns.** *Built today* is ✅ built / 🟡 partial / ❌ missing with a
code pointer. *New backend* says whether the frame needs anything the API does
not already serve. *Current / superseded* is judged from node ids (higher =
edited later) and prototype arrows; a "superseded" frame is still kept when it
is the only one that shows a state. Requirement IDs (`R-8`, `N-9`…) are from
`docs/product-context.md` §4; the plan is `docs/plans/final-iteration-plan.md`.

---

## 00-components — the component sheet

| Thumbnail | Node | Situation | State | Built today | New backend | Current / superseded |
| --- | --- | --- | --- | --- | --- | --- |
| [components-sheet](00-components/components-sheet__393-6562.png) | 393:6562 | The whole sheet: View Toggle, Listed Event rows, Text Fields, Checkboxes, Option Toggle, Filter Tag, Tag pills, Main Card, "26 GOING" pill, Button w, Saved Event Card, Modal Card, Filter Accordion, Toast, Expanded Card | Static | 🟡 see rows below | None | Current |
| [view-toggle](00-components/view-toggle__13-100.png) | 13:100 | Segmented Card / List (and Card / Grid) toggle, icon + label, cyan active | Static | 🟡 `components/member/MemberChrome.tsx:11` `ViewToggle` is carousel/grid, icon-only | None | Current — every screen frame uses the List variant (D-14) |
| [member-listed-event](00-components/member-listed-event__399-6259.png) | 399:6259 | Feed list row: photo, tag pills, title, relative date, time, location, attendees, "More information →" | Static | ❌ no list mode; nearest `components/member/GridFeed.tsx:14` `GridCard` | None — all fields on `EventOut` | Current (D-14) |
| [saved-event-card](00-components/saved-event-card__399-10657.png) | 399:10657 | Portrait saved card: photo with overlaid tags, title, relative date + time, location, "20 People Going"; no un-save control | Static | 🟡 `GridCard` (has the bookmark the design lacks) | None | Superseded by the 2-column card in 468:14558 |
| [event-thumbnail](00-components/event-thumbnail__441-10984.png) | 441:10984 | Large and small saved thumbnails — the collapsed sidebar rail's items | Static | ❌ no rail | None | Current (D-15, pending decision) |
| [modal-card](00-components/modal-card__399-12505.png) | 399:12505 | "You're not logged in! Create an account to save events to your page and calendar" → Create an account / Login / Continue as guest; role cards; fields | Overlay-modal | 🟡 `components/member/LoginOverlay.tsx` goes straight to the name step | None | Current; later repurposed as the share modal (465:14401) |
| [toast](00-components/toast__404-26615.png) | 404:26615 | Three variants: delete confirm (Cancel / Yes, delete), "…was successfully deleted [Undo]", guest notice ("Later / Sign up/Login") | Transient (a, b) / Overlay (a) | 🟡 (a) `components/host/PostedEvents.tsx:562` `ConfirmDelete`; (b) `UndoToast` `:519`; (c) ❌ | None | Current |
| [admin-listed-event](00-components/admin-listed-event__18-3139.png) | 18:3139 | Console row: thumbnail, tags, title, date/time/location, edit / send / print / delete icons, › chevron | Static | ✅ `PostedEvents.tsx:241` `PostedEventCard` (icons at `:373-403`) | None | Superseded by 481:5307's View Details card, but the icons are what N-7 needs |

## 01-feed-card-view — the carousel (`/`)

| Thumbnail | Node | Situation | State | Built today | New backend | Current / superseded |
| --- | --- | --- | --- | --- | --- | --- |
| [card-view](01-feed-card-view/card-view__543-12713.png) | 543:12713 | Signed-out feed: persistent **left sidebar** ("0 Saved Events", dashed "Saved Events go Here", See Saved Events / Google Calendar), "EVENT FILTERS" chips (FREE, SPORTS, FOOD, SOCIAL, ART, GAMES, INFORMATIVE), one card with FREE / SIGN-UP / IN-PERSON pills, "In 7 days · Aug 28", time, address, "20 Attendees", "More information →" + "Save event 🔖", ↑/↓ buttons | Static | 🟡 carousel + `WideEventCard` (`components/member/FeedParts.tsx:210`); missing sidebar (saved list is a full-screen overlay, `components/EventsView.tsx:999-1013`; drop zone is the *bottom* `SaveZone`, `FeedParts.tsx:398`), chip row (`EventsView.tsx:1026-1028`), pills, relative date, time, attendees, on-screen ↑/↓ | R-8 for the calendar button; everything else is on `EventOut` | **Current** (highest ids on the page) |
| [card-view](01-feed-card-view/card-view__399-6634.png) | 399:6634 | Same layout, earlier pass; sidebar open and empty, second card peeking beneath | Static | 🟡 as above | None | Current layout, re-edited at 543–545 |
| [main-page-card-view](01-feed-card-view/main-page-card-view__546-13478.png) | 546:13478 | Signed-out feed, the state from which the sign-in modal opens ("Button w → Sign up/Login Page") | Static | ✅ `EventsView.tsx:347` `toSignIn` | None | Current |
| [main-page-card-view-saved-panel](01-feed-card-view/main-page-card-view-saved-panel__546-13680.png) | 546:13680 | Signed-out, saved panel open ("0 Saved Events", All Saved Events / Google Calendar) | Static | 🟡 panel is signed-in only today (`components/SavedEvents.tsx:178-193` shows Sign in) | R-8 | Current; guests seeing an empty panel is a teaser at most |
| [card-view-saved-hover](01-feed-card-view/card-view-saved-hover__399-9447.png) | 399:9447 | Card **dragged left** toward the sidebar: lifted, rotated ~−4°, drop zone tinted "Drag events here", Save button pressed; heading "SORT EVENTS BY 0 FILTERS" | Mid-animation | 🟡 drag-to-save exists (`EventsView.tsx:1135-1180`) but **down**, no rotation; ArrowDown saves | None | Current for the gesture (D-15 decision); note filter/sort heading disagrees with 543:12713 |
| [card-view-saved](01-feed-card-view/card-view-saved__399-9643.png) | 399:9643 | After the drop: sidebar lists thumbnails, card button greyed "Event Saved 🔖"; sidebar header still "0 Saved Events" | Static | 🟡 "Saved ✓" text (`FeedParts.tsx:311`) + count badge; re-press un-saves (R-4) | None | Current; design has no un-save on the card (moves to 461:11216) |
| [card-view-saved](01-feed-card-view/card-view-saved__445-11526.png) | 445:11526 | Named SAVED but nothing is in a saved state; different program on the card; 804px tall | Static | 🟡 as 399:6634 | None | Superseded for the state (399:9643 carries it); current for layout |
| [card-view-saved-closed](01-feed-card-view/card-view-saved-closed__435-10236.png) | 435:10236 | Sidebar collapsed to a 100px rail: "» Open", four saved thumbnails, Events / Calendar buttons — under a "Not Logged In" header | Static | ❌ rail; nearest `GridFeed.tsx:335` `SavedEventsButton` | None | Current; internally inconsistent (saved thumbnails while signed out) |

## 02-feed-list-view — the list view (`/`, second mode)

| Thumbnail | Node | Situation | State | Built today | New backend | Current / superseded |
| --- | --- | --- | --- | --- | --- | --- |
| [list-view-saved-open](02-feed-list-view/list-view-saved-open__393-7397.png) | 393:7397 | "24 Unique Events"; same chips; full-width rows (`Member - Listed Event`) with hairline dividers; sidebar open | Static | 🟡 toggle exists but the second mode is a 3-column **grid** (`GridFeed.tsx:219`); dedupe (`lib/feed.ts` `oneCardPerProgram`) and search (`GridFeed.tsx:292`) exist | None | Current (D-14) |
| [list-view-saved-closed](02-feed-list-view/list-view-saved-closed__393-7684.png) | 393:7684 | Same list with the rail collapsed; toggle wrongly highlights Card View | Static | 🟡 as above; rail ❌ | None | Current (Figma slip on the toggle) |

## 03-event-details — the More Information modal (`EventDetailModal`, twin `/events/[id]`)

| Thumbnail | Node | Situation | State | Built today | New backend | Current / superseded |
| --- | --- | --- | --- | --- | --- | --- |
| [more-information](03-event-details/more-information__399-8255.png) | 399:8255 | Expanded card over a blurred feed: tags, **Share ✈ / Print 🖨** top-right, image, title, relative date, time, address, "20 Attendees", DETAILS, **LINKS** (×2, paperclip), footer **See on Map 🗺 + Register for Event ↗** (external variant), × outside | Overlay-modal | 🟡 modal, blur, outside ×, Escape, focus trap, both registration branches (`components/member/EventDetailModal.tsx:46-151`); missing pills, time, attendees, Share, Print, Map, LINKS | **N-9** `events.links`; M-10 share; print none; map = search URL | Current (component instance) |
| [more-information](03-event-details/more-information__469-15593.png) | 469:15593 | Same, footer **Save Event ⬇** (internal / drop-in variant) | Overlay-modal | 🟡 Save branch exists `EventDetailModal.tsx:143-151` | As above | Current; download-arrow icon ≠ bookmark used on the card |
| [more-information](03-event-details/more-information__461-11216.png) | 461:11216 | Same, **saved** variant: footer **Google Maps 📍 + Un-Save Event ⊠** (red outline). Reached from a saved thumbnail | Overlay-modal | ❌ in the modal (button is a disabled "Saved ✓", `:145`); un-save exists on `GridCard` and via `DELETE /events/{id}/attend` (`backend/app/api/routes/attendance.py:139`) | None | Current for the saved variant (detached copy; component should grow a `saved` variant) |
| [more-information](03-event-details/more-information__399-11385.png) | 399:11385 | Earlier instance over the retired day-sectioned grid; **Save Event drawn pink with a red border** | Overlay-modal + Hover-focus | 🟡 as above | As above | Backdrop superseded; pink fill unexplained (saved state? error?) |
| [more-information](03-event-details/more-information__404-28474.png) | 404:28474 | Same, both See on Map and Save Event cyan | Overlay-modal + Hover-focus (See on Map pressed) | 🟡 | As above | Backdrop superseded; pair with 399:11385 as the two button states |
| [more-information-share](03-event-details/more-information-share__404-28717.png) | 404:28717 | Second-level dialog: "Who would you like to send this event to? We will send a link to add the event to their calendar." Share to [email] / Send email | Overlay-modal | ❌ no member-side share; `components/CopyLinkButton.tsx` is console-only | **M-10** `POST /events/{id}/share` + **P-6** HTML mail + **R-8** attachment | Current for the flow; 472:12046 is the later variant |

## 04-saved-events — the saved list (`SavedEvents.tsx`)

| Thumbnail | Node | Situation | State | Built today | New backend | Current / superseded |
| --- | --- | --- | --- | --- | --- | --- |
| [see-saved-events-present-list](04-saved-events/see-saved-events-present-list__468-14558.png) | 468:14558 | **Page**: Card/Grid toggle, "← All Saved Events (10)", search, **Google Calendar / Share list ✈ / Print list 🖨**, Upcoming \| Past tabs, 2-column landscape cards ("20 Attendees") | Static | 🟡 overlay with search, Upcoming / per-topic / Past sections, `GridCard` rows (`SavedEvents.tsx:151-260`); missing route/back arrow, tabs, the three actions | R-8, M-10, M-11; print none | **Current** iteration of the list body |
| [see-saved-events-present](04-saved-events/see-saved-events-present__399-10360.png) | 399:10360 | Same page with the older 3-column portrait card, Past tab selected, ← Back / Next → pagination, Print list drawn pressed | Static + Hover-focus (Print list) | 🟡 as above | As above | Superseded by 468:14558 for the card; only frame showing tabs + pagination |
| [see-saved-events-present-list](04-saved-events/see-saved-events-present-list__491-11595.png) | 491:11595 | Same grid with **no header, back arrow or tabs** — content only | Static | 🟡 | As above | Highest id in the section; ambiguous (scrolled state / tabs dropped / mail body) — don't build from it alone |
| [see-saved-events-empty-signed-out](04-saved-events/see-saved-events-empty-signed-out__469-15302.png) | 469:15302 | "All Saved Events (0)" — "You don't have any saved events yet! Login to start saving events." [Login] | Static | ✅ `SavedEvents.tsx:178-193` (copy differs) | None | Current |
| [see-saved-events-empty](04-saved-events/see-saved-events-empty__469-15499.png) | 469:15499 | Same, signed in: [Browse Events 🔍] — sub-line still says "Login…" | Static | ✅ `SavedEvents.tsx:326-342` `EmptyAll` (no Browse button; closing is the equivalent) | None | Current; copy bug |
| [saved-events-present-unsave-toast](04-saved-events/saved-events-present-unsave-toast__431-13693.png) | 431:13693 | Earlier **panel** treatment with the toast "*Summer Baking…* was unsaved. [Undo]" over a blurred header | Transient | 🟡 un-save exists; the toast is only an `aria-live` announcement (`EventsView.tsx:444, :926`) | None — Undo = re-`POST /attend` (`attendance.py:49-76`) | Superseded panel; only frame with the unsave toast (D-16) |
| [saved-events-present](04-saved-events/saved-events-present__446-13000.png) | 446:13000 | Panel sectioned "Today \| September 11" / "Tomorrow \| September 12", actions in a bottom bar | Static | 🟡 sections are Upcoming / topic / Past, not by day | R-8, M-10 | Superseded (day sectioning was dropped — see `GridFeed.tsx:57` comment) |
| [saved-events-none](04-saved-events/saved-events-none__429-13451.png) | 429:13451 | Panel empty state, merged signed-out/signed-in copy | Static | ✅ both branches exist separately | None | Superseded by 469:15302 / 469:15499 |

## 05-print-and-email — print previews, share modals, mail templates

| Thumbnail | Node | Situation | State | Built today | New backend | Current / superseded |
| --- | --- | --- | --- | --- | --- | --- |
| [saved-events-print-preview](05-print-and-email/saved-events-print-preview__465-14216.png) | 465:14216 | "👁 Printing Preview — List of Sam's Events": divider-separated list (image, tags, title, date, time, address, attendees); Cancel / Print List 🖨 | Overlay-modal | ❌ member side; pattern exists in the console (`app/globals.css:44-60`, `PostedEvents.tsx:376-384`) | None — `window.print()` + print CSS over `GET /users/me/events` | Current (M-8) |
| [print-individual-event](05-print-and-email/print-individual-event__471-5101.png) | 471:5101 | Same modal for one event (DETAILS, LINKS); heading still "List of Sam's Events"; Cancel / Print Event 🖨 | Overlay-modal | ❌ member side | None (LINKS needs N-9) | Current; heading is a copy-paste error |
| [modal-share-list-of-events](05-print-and-email/modal-share-list-of-events__472-12046.png) | 472:12046 | Share **one event**: "Enter Email of Recipient" [Send ✈] — no copy-link option | Overlay-modal | ❌ | **M-10** `POST /events/{id}/share`, **P-6** | Current; heading says "list of events" |
| [modal-share-by-email-or-link](05-print-and-email/modal-share-by-email-or-link__465-14401.png) | 465:14401 | Share **the saved list**: Share by Email [Send ✈] and Share by Link "Https//SamKWEventslist" [Copy Link ⧉] | Overlay-modal | ❌ | **M-10** list mail; **M-11** tokenised public list URL (privacy decision) | Current; a repurposed sign-up modal (stale hidden layers) |
| [event-list-email-template](05-print-and-email/event-list-email-template__465-14503.png) | 465:14503 | KW Habilitation-branded mail: "Hi {caregiver_name}, {Community member name} sent you a list of Events using the KWEvents tool!"; four rows; "View Events on our Platform ↗" | Static (email) | ❌ | **P-6** HTML mail; `{caregiver_name}` has no source (A-8) | Current; connector name reveals it was reworked from a "Create your password" LMS mail |
| [event-list-email-template](05-print-and-email/event-list-email-template__469-16790.png) | 469:16790 | Single-event mail: one event with DETAILS and two LINKS rows; no button back | Static (email) | ❌ | P-6, N-9 | Current; "a list of Event" copy leftover |

## 06-auth-member — member sign-up / login (`LoginOverlay`, `/signup`)

| Thumbnail | Node | Situation | State | Built today | New backend | Current / superseded |
| --- | --- | --- | --- | --- | --- | --- |
| [signup-login-page](06-auth-member/signup-login-page__399-12190.png) | 399:12190 | Modal over the feed: "You're not logged in! Create an account to save events to your page and calendar" — Create an account / Login / Or / Continue as guest | Overlay-modal | 🟡 `LoginOverlay.tsx:14-41` goes straight to the name step; no three-way chooser; close = guest | None | Current |
| [create-account-name](06-auth-member/create-account-name__399-14571.png) | 399:14571 | Step 1: First name, Last name; Login / Next | Overlay-modal | ✅ `LoginOverlay.tsx:146-170`, `app/signup/page.tsx:144-190` (typed — A-4 still open) | None | Current — the one screen both flows share |
| [create-account-email](06-auth-member/create-account-email__403-14911.png) | 403:14911 | Step 2: "Provide your email — now we can send all your saved events to your email!" **Email\*** required | Overlay-modal | ❌ `User` has no email (`backend/app/models/user.py:24-59`) | `users.email` (nullable) + mailer; **conflicts with R-7** (never required) | Current; decision §5.1 |
| [create-account-password](06-auth-member/create-account-password__403-15246.png) | 403:15246 | Step 3: Password\*, Confirm\* (min 5); Login / Create account | Overlay-modal | ❌ in UI; dormant `custom_password` path in `backend/app/api/routes/auth.py:118-165` (min 8) | Only if passwords replace icons: icons nullable, email-keyed login, member password reset | Current; **conflicts with A-1** (the icon key is the password) — §5.1 |
| [account-creation-complete](06-auth-member/account-creation-complete__425-10922.png) | 425:10922 | Green check "Account creation complete! You're now free to browse and save events" — Go back / Continue to events; header still "Not Logged In" | Overlay-modal | 🟡 `/signup` has a "You're in" transition (`signup/page.tsx:507-548`); the overlay just closes | None | Current; no "remember your icons" screen because there are no icons |
| [login](06-auth-member/login__404-29057.png) | 404:29057 | "Login to your account — please login with your email and password." Cancel / Login | Overlay-modal | ❌ member login is name + icons (`LoginOverlay.tsx:174`, `auth.py:195-293`) | Email as lookup key (unique?), rate-limit key | Current; no forgot-password link at all — §5.1 |
| [login-account-confirmation-toast](06-auth-member/login-account-confirmation-toast__404-29510.png) | 404:29510 | Green toast "Successfully logged in!"; header now "Sophie L." | Transient | 🟡 chrome re-renders with the name (`MemberChrome.tsx:234-283`); no visible toast | None | Current (D-16: toast + "First L." name) |
| [guest-account-toast](06-auth-member/guest-account-toast__404-28235.png) | 404:28235 | Blue toast "You're currently viewing as a guest — please login or sign-up to save" — yet the header shows "Sophie L." | Transient | 🟡 signed-out browsing exists (R-3); no toast; no guest *account* | Only if guest = name-only account (R-10) | Current; self-contradictory — §5.6 |

## 07-auth-npo — organizer accounts (`/host`, `/host/invite/[token]`)

| Thumbnail | Node | Situation | State | Built today | New backend | Current / superseded |
| --- | --- | --- | --- | --- | --- | --- |
| [create-account](07-auth-npo/create-account__403-15951.png) | 403:15951 | Canvas note "Non-profits only accessible via special link". Page: KW Hab logo, "Create an account for your non-profit": First, Last, Email\*, Set password\*, Confirm\*; Create account | Static (full page) | 🟡 `app/host/invite/[token]/page.tsx` is this page (org + email fixed by the invite, password + confirm) | Only if per-person names are wanted: `hosts.contact_*` — §5.9 | Current; the special link **is** the invite token (A-7 holds) |
| [email-verification](07-auth-npo/email-verification__404-16111.png) | 404:16111 | "We've sent a code to your email / click the link to verify" — 6-digit code, Verify account | Static | ❌ and redundant: the invite link already proves the mailbox (`backend/app/api/routes/invites.py:44-80`) | A verification table + endpoint if insisted on | Current; recommended not to build |
| [login](07-auth-npo/login__404-16160.png) | 404:16160 | "Login to KWhab Events": Email, Password, Login (no forgot-password) | Static | ✅ `app/host/page.tsx` (`POST /auth/login/host`); code also has forgot-password (A-5) — keep it | None | Current; branding "KWhab Events" |

## 08-admin-posted-events — the console list (`/host/events`)

| Thumbnail | Node | Situation | State | Built today | New backend | Current / superseded |
| --- | --- | --- | --- | --- | --- | --- |
| [posted-events-all-events](08-admin-posted-events/posted-events-all-events__481-5307.png) | 481:5307 | **All Events** tab; filter accordion; search + Create new event; cards with photo, pills, title, "In 7 days", time, location, **"20 Attendees"**, one **View Details →** | Static | 🟡 list, filters, search, create (`app/host/events/page.tsx:187-249`, `PostedEvents.tsx:102-237`); missing Your/All toggle, details page, relative date, attendee wording | Optional `host_id=`/`mine=` on `GET /events` (N-12); count = `saved_count` (M-1) | **Current** |
| [posted-events-your-events-empty](08-admin-posted-events/posted-events-your-events-empty__481-6170.png) | 481:6170 | **Your Events** empty: "You haven't posted any events yet!" + Create New Event + | Static | 🟡 one-line `<p>` (`events/page.tsx:222-227`), no tab, no button | None | Current; subtitle pasted from the member empty state — don't ship |
| [event-details-readonly](08-admin-posted-events/event-details-readonly__486-14236.png) | 486:14236 | Read-only **Event Details** page: photo, name/date/time/location; description, numbered Important Links, pills; header **Edit Event Details** / **Un-publish Event** (red) | Static | ❌ no console detail view; another org's program is an unclickable title (`PostedEvents.tsx:324-335`) | None (`GET /events/{id}` exists); N-9 for links | Current (N-11); "Un-publish" is the right word for the archive |
| [event-details-published-toast](08-admin-posted-events/event-details-published-toast__484-13832.png) | 484:13832 | Details page right after publishing; green toast "Event Successfully Published!" (no Undo) | Transient | 🟡 `UndoToast` fires on the list, with Undo (`events/page.tsx:91-110`) | None | Current; keep Undo (N-6), take the look |
| [posted-events-filters-expanded](08-admin-posted-events/posted-events-filters-expanded__404-16260.png) | 404:16260 | Accordion fully expanded: Non-Profit (6), Price, Registration Type, Event Type, Activity Type, All Events | Static | ✅ `FilterPanel` (`PostedEvents.tsx:92-149`) + two extra groups (Spaces Left, Age) | None | Older chrome; only frame showing the expanded state |
| [delete-event-confirm-modal](08-admin-posted-events/delete-event-confirm-modal__404-25969.png) | 404:25969 | "Are you sure you want to delete this event? *Open Space…*" Cancel / Yes, delete (pink) | Overlay-modal | ✅ `ConfirmDelete` (`PostedEvents.tsx:562`); `components/DeleteConfirmModal.tsx` is a second, unused copy | None | Older chrome; wording should become Un-publish (N-11) |
| [event-edited-toast](08-admin-posted-events/event-edited-toast__404-26984.png) | 404:26984 | "…was successfully edited" with Undo | Transient | 🟡 edit confirms by name, deliberately without Undo (`events/page.tsx:261-264`) | An edit-Undo would need a row snapshot — not worth it | Older chrome; keep code |
| [event-shared-toast](08-admin-posted-events/event-shared-toast__404-27250.png) | 404:27250 | "…was successfully shared" (no Undo) | Transient | ✅ copy-link confirmation (`events/page.tsx:164-175`, N-7) | None | Older chrome; v2 cards have no share icon — §5 confirmation |
| [event-deleted-toast](08-admin-posted-events/event-deleted-toast__404-26301.png) | 404:26301 | Named "Event deleted" but reads "…was successfully posted!" with Undo | Transient | ✅ delete toast with Undo → `POST /events/{id}/restore?series=true` (`events/page.tsx:151-158`) | None | Older chrome; Figma copy error |

## 09-admin-event-form — create / edit (`EventForm`)

| Thumbnail | Node | Situation | State | Built today | New backend | Current / superseded |
| --- | --- | --- | --- | --- | --- | --- |
| [create-new-event-blank](09-admin-event-form/create-new-event-blank__483-12966.png) | 483:12966 | Two-column **Create a New Event**: image, Name\*, Date\*, Time\* (start–end), Location\*, Brief Description (max 1000), Important Links ×3, tags Free/Paid · Drop-in/Registration · Virtual/In-Person; **Publish Event** in the header | Static | 🟡 `components/host/EventForm.tsx:307`; missing end time (`ends_at` already accepted, `:386-394`), links, 1000 cap; code has more fields the design dropped (category, pricing, recurrence, capacity, ages, notes, youth, access tags) | **N-9** links; optional description cap (N-12) | Current; name placeholder "Enter your first name" is a bug |
| [edit-event-details-filled](09-admin-event-form/edit-event-details-filled__484-13371.png) | 484:13371 | Same form prefilled as a **page**: Change Image, **Save Edits** in header | Static | 🟡 edit is a modal around the same form (`components/EditEventModal.tsx:55-66`) — N-2 holds either way | None | Current; page vs modal is routing (N-11) |

## 10-superadmin — superadmin surfaces (`/host/admins`, `/host/events`)

| Thumbnail | Node | Situation | State | Built today | New backend | Current / superseded |
| --- | --- | --- | --- | --- | --- | --- |
| [superadmin-event-management](10-superadmin/superadmin-event-management__486-14643.png) | 486:14643 | 481:5307 plus a top-centre **Account Management / Event Management** switch | Static | ✅ different shape: `ConsoleHeader` pills Events / Users / Organizations (`components/host/ConsoleHeader.tsx:53-57`) | None | Current; design has two destinations, code three (Users = member key reset, A-3 — keep) |
| [superadmin-account-management](10-superadmin/superadmin-account-management__486-14826.png) | 486:14826 | "All Administrative Members": **Invite New Members** (email + Send Email); table Name / Email / Non-Profit with several people per agency, red trash per row | Static | 🟡 `app/host/admins/page.tsx:163-246` table (Name / Email / Access / Programs / Actions); invite modal hands back a link to paste (`:288-320`) | **N-10** send the invite by mail | Current; multi-person orgs **conflict with §3.5**; trash undersells "archives the org and its programs" |

## 99-superseded

| Thumbnail | Node | Superseded by | Why |
| --- | --- | --- | --- |
| [posted-events-admin-v1](99-superseded/posted-events-admin-v1__404-16185.png) | 404:16185 | 481:5307 | Same list in the older chrome; per-card icon row instead of View Details |
| [posted-events-admin-v1-duplicate](99-superseded/posted-events-admin-v1-duplicate__404-27518.png) | 404:27518 | 481:5307 | Pixel-identical duplicate of 404:16185 |
| [posted-events-superadmin-v1](99-superseded/posted-events-superadmin-v1__404-25712.png) | 404:25712 | 486:14643 | Visually identical to the admin frame; the old superadmin distinction was delete only |
| [create-new-event-v1](99-superseded/create-new-event-v1__482-12866.png) | 482:12866 | 483:12966 | Single-column v1 form — the one today's `EventForm` was built from |
| [create-new-event-v1-duplicate](99-superseded/create-new-event-v1-duplicate__404-26725.png) | 404:26725 | 483:12966 | Duplicate of 482:12866 |
| [create-event-stub-v0](99-superseded/create-event-stub-v0__404-27729.png) | 404:27729 | 483:12966 | Stub with one field and a stray Login button |

Also on the page: the **Hover States Guide** section (487:12124) is empty, and
connector 432:13893 / 468:15229 are prototype arrows, not frames.

---

## Backend work implied by the design (deduplicated)

| # | Work | Frames | Register ID | Note |
| --- | --- | --- | --- | --- |
| 1 | `.ics` export per event (and per saved list) + Google Calendar template link | 543:12713, 546:13680, 468:14558, 404:28717 | **R-8** | No schema change. The Google Calendar button has no prototype arrow — behaviour undefined; the plan §4 answers it. |
| 2 | HTML / multipart mail in `backend/app/core/mail.py` (plain-text `smtplib` today) + real `SMTP_*` in prod | 465:14503, 469:16790, 486:14826 | **P-6** | Prerequisite for 3, 4 and 7. Unset SMTP means "logged, not sent". |
| 3 | Share one event by email: `POST /events/{id}/share {to_email}`, rate-limited per member and per IP | 404:28717, 472:12046, 469:16790 | **M-10** | Recipient address typed per send, never stored on the member (keeps R-7). Auth required, or it is an open relay. |
| 4 | Share the saved list by email: `POST /users/me/events/share {to_email}` | 465:14401, 465:14503 | **M-10** | Same sender; data from `my_events`. `{caregiver_name}` has no source (A-8). |
| 5 | Tokenised public saved-list URL: `GET /shared/{token}`, `/shared/[token]` page, opt-in creation + revocation | 465:14401 | **M-11** | Privacy decision first (plan §5.7). |
| 6 | `events.links` — up to three `{label, url}` (JSONB), on create/update/out, host form, validation | 399:8255, 486:14236, 483:12966, 469:16790 | **N-9** | Decide its relation to `registration_url` first (plan §5.8). |
| 7 | Emailed organizer invites: `POST /invites` mails the link instead of returning a token to paste | 486:14826 | **N-10** | Design's form has no organization field; `HostInvite` requires one. |
| 8 | Optional: `host_id=`/`mine=` on `GET /events`; server-side 1000-char description cap | 481:5307, 483:12966 | **N-12** | Both client-side today. |
| 9 | Member email column (nullable) — only if §5.1 allows optional email | 403:14911 | A-8 / R-7 | Required email is the conflict; the column is cheap. |
| 10 | Member password login + email reset — only if passwords replace or supplement icons | 403:15246, 404:29057 | A-1 (decision) | Large: icons nullable, email-keyed login, reset table, min-length policy (5 vs 8). |
| 11 | Guest account type — only if "guest" = name-only account | 404:28235 | R-10 (decision) | Then P-3a (creation cap) becomes urgent. |
| 12 | NPO email-verification code table + endpoint | 404:16111 | A-7 | Recommended **not** built; the invite link already verifies the mailbox. |
| 13 | Organizer contact names (`hosts.contact_*`) — only if §3.5 is reopened | 403:15951, 486:14826 | A-6 (decision) | |
| — | **Nothing needed** for: tag pills, attendee counts (`saved_count`), time ranges, relative dates, un-save + Undo (`POST /attend` re-saves), print previews (`window.print()`), See on Map (search URL), console details view (`GET /events/{id}`), Un-publish (archive + restore exist), end time (`ends_at` accepted) | | | |

## Conflicts with recorded decisions (deduplicated)

Each is written up with options in `docs/plans/final-iteration-plan.md` §5.

1. **Member credential.** Design: name → required email → password (min 5), email+password login, no forgot-password. Record: the two-icon key *is* the password (A-1, CLAUDE.md), recovery is superadmin re-issue (A-3), contact details never required (R-7). — plan §5.1
2. **Saved sidebar + drag-left** (all card/list frames) vs the bottom save zone, drag-down, full-screen saved overlay, and ArrowDown = save. Touches every one of the six save paths (X-1) and reduced motion (X-7). — §5.2
3. **Filter chips**: "EVENT FILTERS" vs "SORT EVENTS BY"; vocabulary FREE/SPORTS/FOOD/SOCIAL/ART/GAMES/INFORMATIVE is not `CATEGORIES` (D-1a/D-1b, CLAUDE.md single list). — §5.4
4. **Public "20 Attendees" / "People Going"** on member cards and console cards vs D-7 (private) and M-1 (console counts descoped); label overstates (a save is not attendance). — §5.5
5. **"Continue as guest" + guest toast with a signed-in header** vs R-3 (browsing is already open; saving needs an account). — §5.6
6. **Share-by-link to a member's saved list** with no approval vs D-7 ("with known people, with approval") for a vulnerable population. — §5.7
7. **Important Links ×3** vs the typed `registration_url` that §3.1's four states hang off. — §5.8
8. **Multi-person organizations** (superadmin table, per-person names on the NPO create page, "Sophia L. / Admin" header) vs §3.5 one login per agency. — §5.9
9. **Email branding**: templates and organizer pages say "KW Habilitation" / "KWEvents"; console says The Belonging Collective; `MAIL_FROM` is one mailbox for six agencies. — §5.11
10. **Console form scope**: v2 drops category, pricing detail, recurrence, capacity, ages, notes, youth, access tags — each has a register row depending on it (R-6, D-6, D-8, N-1, the 273-occurrence import). Keep the fields; confirm. — §5 confirmations
11. **Delete wording and rule**: v1 "delete", v2 "Un-publish"; design frames imply superadmin-only, code lets an owner un-publish an unsaved program (§3.8, N-5). Adopt "Un-publish", keep the rule. — §5 confirmations
12. **Superadmin surfaces**: design has no Users tab, no Access column / Make superadmin, a bare trash on organizer rows, and a publish toast without Undo; code has all four for recorded reasons (A-3, N-4, the archive-org-and-programs invariant, N-6). Keep code. — §5 confirmations
13. **NPO email-verification step** duplicates what the invite link proves (A-7). Skip. — §5 confirmations
14. **Copy vs §3.3** ("Login to start saving events.", "Create an account to save events to your page and calendar", "We will send a link to add the event to their calendar.") — explanations on the member surface; reduce to labels when built. Plus design copy bugs not to ship: "List of Sam's Events" on a single event, "a list of Event", "Event deleted" toast reading "posted", "Enter your first name" as the event-name placeholder, "Login to start saving events." on signed-in and console empty states.
15. **CLAUDE.md is stale about the console**: `/host/events` has been `AdminShell … bare` with `ConsoleHeader` + `PostedEventCard` since PR #20; the sidebar and tables remain only on the other `/host` pages. Docs fix, not a code change.
