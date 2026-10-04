# Hushmate UI mockups

Design-language mockups for the screens in `devpost/prd.md` and `devpost/spec.md`. Written 2026-10-04. Nothing here is production code.

**Open `mockups/index.html`.** Every page shows each state in 390px phone frames, **dark and light side by side**, labelled with the spec.md and prd.md headings it implements.

## What is here

| Path | What it is |
|---|---|
| `mockups/index.html` | Links to every page |
| `mockups/tokens.css` | The design system's `tokens.css` with one value changed (see "Conventions") |
| `mockups/mockup.css` | Component styles used by the mockups. Uses only `var(--hm-*)` tokens. Each page also inlines both CSS files, so a page opens on its own |
| `mockups/*.html` | One page per screen (below) |

### The eight required screens

| # | Screen | Page |
|---|---|---|
| 1 | Landing, sign up, sign in | [`sign-in.html`](mockups/sign-in.html) |
| 2 | Onboarding | [`onboarding.html`](mockups/onboarding.html) |
| 3 | Schedule (Calendar) | [`calendar.html`](mockups/calendar.html) |
| 4 | Quiet-time editor | [`quiet-time-editor.html`](mockups/quiet-time-editor.html) |
| 5 | Nudge sheet | [`nudge-sheet.html`](mockups/nudge-sheet.html) |
| 6 | Nudge overlay and notifications | [`nudge-overlay.html`](mockups/nudge-overlay.html) |
| 7 | Summary | [`summary.html`](mockups/summary.html) |
| 8 | Demo welcome card | [`demo-welcome.html`](mockups/demo-welcome.html) |

### Extra pages (not on the required list, but states the PRD and spec name)

| Page | Screen |
|---|---|
| [`houses.html`](mockups/houses.html) | Houses |
| [`profile.html`](mockups/profile.html) | Profile |
| [`join-link.html`](mockups/join-link.html) | Join by invite link |

## Conventions

- **Tokens:** `mockups/tokens.css` is `planning/design-system/tokens.css` with the selectors changed and **one value changed**: `--hm-border-control` is `#6B77A9` in dark and `#847D91` in light (design-review decision 2026-10-04, see Decisions 16). Everything else is identical. The selectors changed as follows: (`:root[data-theme="light"]` became `[data-theme="light"]`, and `:root` became `:root, [data-theme="dark"]`) so one page can hold a dark and a light frame. The `prefers-color-scheme` block was dropped because the mockups choose the mode explicitly. The app should take the same border-control value.
- **No new design:** no new colours, type sizes, radii or motion. Avatar initials are 13, 15 and 20px (15px is the design system's own avatar size; 13 and 20 are existing scale sizes), and calendar block text reuses the 12px micro size.
- **Fonts:** Fredoka and Nunito are loaded from Google Fonts with the same `<link>` the design system's `index.html` uses, with the system rounded fallbacks from `tokens.css`. `spec.md` says the real app self-hosts them via Fontsource; that choice stands for the build.
- **Motion:** only three things animate in the mockups: the 4s breathing ring on anyone resting now, the flat skeleton pulse, and the busy spinner. All stop under `prefers-reduced-motion`. Sheets, overlays and count-ups are described in the frame notes rather than animated.
- **Sample content:** the house is "MapleHouse#482913". You are Alex (lavender). Maya, Jordan and Priya borrow the demo bots' schedules from `spec.md > Backend: Demo module`. The scene is Thursday Oct 8, 9:40 PM. Demo screens use "DevPost Demo House" and the Judge accounts.
- **Anonymity check:** no frame shows a sender's name to a recipient, lists nudges to the house, or shows a housemate's email. The one place a recipient's name appears is the sender's own "Your nudge was acknowledged" card (a confirmed behaviour, Decisions 12).
- **Accessibility shown in the frames:** every state carries text or an icon as well as colour (errors have an icon, "away" is a word as well as an outline, selected day chips are filled and spelled out in a summary line); the focus ring is drawn on the focused field in the default frame of each form; touch targets are 48px or more; the peach, mint and butter roles are only used for their one job (toasts carry a neutral dot; only the acknowledgement toast has the mint one).

## Mockup to spec and PRD mapping

Each row is one state frame (a dark and a light phone). The frame link jumps to it.

| Mockup (frame link) | Frame | spec.md heading | prd.md heading |
|---|---|---|---|
| [`sign-in.html`](mockups/sign-in.html#landing-default) | Landing | Frontend: Auth screens > Landing | Core Journey A.1; Screens and Layout > Before sign-in |
| [`sign-in.html`](mockups/sign-in.html#signin-default) | Sign in: default | Frontend: Auth screens > Sign in | Accounts and Sign-In |
| [`sign-in.html`](mockups/sign-in.html#signin-error) | Sign in: wrong email or password (401) | Frontend: Auth screens > Sign in | Accounts and Sign-In |
| [`sign-in.html`](mockups/sign-in.html#signin-throttled) | Sign in: too many tries (429) | Frontend: Auth screens > Sign in; Backend: Auth module (Throttling) | Accounts and Sign-In |
| [`sign-in.html`](mockups/sign-in.html#signin-loading) | Sign in: submitting | Frontend: Auth screens > Sign in | Accounts and Sign-In |
| [`sign-in.html`](mockups/sign-in.html#signin-network) | Sign in: server unreachable | Frontend: Auth screens > Important Failure Modes (backend unreachable) | States and Boundaries |
| [`sign-in.html`](mockups/sign-in.html#signup-default) | Sign up: default | Frontend: Auth screens > Sign up | Accounts and Sign-In (Name rules) |
| [`sign-in.html`](mockups/sign-in.html#signup-errors) | Sign up: field errors (400 / 409) | Frontend: Auth screens > Sign up ("Field errors come from the API's validation messages") | Accounts and Sign-In |
| [`sign-in.html`](mockups/sign-in.html#signup-loading) | Sign up: submitting | Frontend: Auth screens > Sign up | Accounts and Sign-In |
| [`sign-in.html`](mockups/sign-in.html#signup-throttled) | Sign up: too many tries (429) | Frontend: Auth screens > Sign up; Backend: Auth module (Throttling) | Accounts and Sign-In |
| [`onboarding.html`](mockups/onboarding.html#choose) | Choose | Frontend: Onboarding (Start) | Onboarding; Core Journey A.3 |
| [`onboarding.html`](mockups/onboarding.html#create) | Create house | Frontend: Onboarding (Start) | Onboarding; Houses and the Active House (Create a house); Accounts (Name rules) |
| [`onboarding.html`](mockups/onboarding.html#create-err) | Create house: spaces or # in the name | Frontend: Onboarding (Start) | Accounts (Name rules) |
| [`onboarding.html`](mockups/onboarding.html#create-short) | Create house: too short | Frontend: Onboarding (Start) | Accounts (Name rules) |
| [`onboarding.html`](mockups/onboarding.html#create-busy) | Create house: creating | Frontend: Onboarding (Start) | Houses and the Active House |
| [`onboarding.html`](mockups/onboarding.html#created) | House created | Frontend: Onboarding (Start) ("House created") | Onboarding; Houses and the Active House (acceptance: ID shown) |
| [`onboarding.html`](mockups/onboarding.html#created-toast) | House created: link copied | Frontend: Onboarding (Start) | Houses and the Active House |
| [`onboarding.html`](mockups/onboarding.html#join) | Join by ID | Frontend: Onboarding (Start) | Onboarding; Houses and the Active House (Join) |
| [`onboarding.html`](mockups/onboarding.html#join-found) | Join by ID: house found | Frontend: Onboarding (Start) | Onboarding; Core Journey A.3-A.4 |
| [`onboarding.html`](mockups/onboarding.html#join-404) | Join by ID: not found (404) | Frontend: Onboarding (Start) | Houses and the Active House |
| [`onboarding.html`](mockups/onboarding.html#join-409) | Join by ID: already asked / already in (409) | Frontend: Onboarding (Start); API 409 | Houses and the Active House |
| [`onboarding.html`](mockups/onboarding.html#join-demo) | Join: demo house refuses (403) | Frontend: Onboarding (Start) (join by link: "This is a demo house") | Demo House (join requests refused) |
| [`onboarding.html`](mockups/onboarding.html#sent) | Request sent (the end of Part 1 for a joiner) | Frontend: Onboarding (Start) ("Request sent") | Onboarding; States and Boundaries (Waiting for approval) |
| [`onboarding.html`](mockups/onboarding.html#intro) | Setup intro (joiners only) | Frontend: Onboarding (Setup) (intro for joiners) | Onboarding; Notifications (join approved) |
| [`onboarding.html`](mockups/onboarding.html#qt-empty) | Step 1: no quiet times yet | Frontend: Onboarding (Setup) (quiet times step; reuses QuietTimeEditor) | States and Boundaries (No quiet times yet); Onboarding |
| [`onboarding.html`](mockups/onboarding.html#qt-added) | Step 1: a quiet time added | Frontend: Onboarding (Setup) (quiet times step) | Onboarding; Quiet Times (Crossing midnight format) |
| [`onboarding.html`](mockups/onboarding.html#n-default) | Permission: not yet asked | Frontend: Push setup; Frontend: Onboarding (Setup) (notifications step) | Onboarding (acceptance: iPhone guidance); Notifications |
| [`onboarding.html`](mockups/onboarding.html#n-asking) | Permission: turning on | Frontend: Push setup; Frontend: Onboarding (Setup) (notifications step) | Onboarding (acceptance: iPhone guidance); Notifications |
| [`onboarding.html`](mockups/onboarding.html#n-error) | Permission: could not subscribe | Frontend: Push setup; Frontend: Onboarding (Setup) (notifications step) | Onboarding (acceptance: iPhone guidance); Notifications |
| [`onboarding.html`](mockups/onboarding.html#n-granted) | Notifications on (just turned on) | Frontend: Push setup; Frontend: Onboarding (Setup) (notifications step) | Onboarding (acceptance: iPhone guidance); Notifications |
| [`onboarding.html`](mockups/onboarding.html#n-ios) | iPhone: Add to Home Screen | Frontend: Push setup; Frontend: Onboarding (Setup) (notifications step) | Onboarding (iPhone Home Screen; sign in again); Core Journey A.7 |
| [`onboarding.html`](mockups/onboarding.html#n-denied) | Permission denied | Frontend: Push setup; Frontend: Onboarding (Setup) (notifications step) | Notifications ("Declining is the user's choice"); States and Boundaries |
| [`onboarding.html`](mockups/onboarding.html#n-unsupported) | Browser unsupported | Frontend: Push setup; Frontend: Onboarding (Setup) (notifications step) | States and Boundaries (Notifications off or not installed) |
| [`calendar.html`](mockups/calendar.html#day-default) | Day view: default | Frontend: Calendar > DayView | Schedule (Calendar); Look and Feel (Filled vs outlined) |
| [`calendar.html`](mockups/calendar.html#day-away) | Day view: a housemate is away | Frontend: Calendar > DayView (outlined with the word "away") | Look and Feel (Filled vs outlined); Houses and the Active House; States and Boundaries (Away housemate) |
| [`calendar.html`](mockups/calendar.html#day-cooldown) | Day view: Nudge cooling down | Frontend: Calendar > Nudge sheet (CooldownPill) | Nudging (Limit; countdown) |
| [`calendar.html`](mockups/calendar.html#day-six) | Day view: six housemates (demo house layout) | Frontend: Calendar > DayView; Demo welcome card | Demo House (six members); Schedule |
| [`calendar.html`](mockups/calendar.html#week-default) | Week view: default | Frontend: Calendar > WeekView | Schedule (Calendar) (week toggle); Quiet Times |
| [`calendar.html`](mockups/calendar.html#week-away) | Week view: a housemate is away | Frontend: Calendar > WeekView | Look and Feel (Filled vs outlined) |
| [`calendar.html`](mockups/calendar.html#empty-none) | No quiet times yet (and nobody else in the house) | Frontend: Calendar > DayView; Quiet-time editor | States and Boundaries (No quiet times yet; A house with only you) |
| [`calendar.html`](mockups/calendar.html#empty-me) | No quiet times yet (housemates have some) | Frontend: Calendar > DayView | States and Boundaries (No quiet times yet); Quiet Times (optional) |
| [`calendar.html`](mockups/calendar.html#only-you) | A house with only you | Frontend: Calendar > DayView; Nudge sheet | States and Boundaries (A house with only you) |
| [`calendar.html`](mockups/calendar.html#waiting) | Waiting for approval (no active house) | Frontend: Calendar > App shell and routing; Frontend: Onboarding (Start, "Request sent") | Onboarding; States and Boundaries (Waiting for approval) |
| [`calendar.html`](mockups/calendar.html#loading) | Loading | Frontend: Calendar > Calendar | Look and Feel (Motion) |
| [`calendar.html`](mockups/calendar.html#error) | Can't reach Hushmate | Important Failure Modes (backend unreachable); Frontend: API client and session | States and Boundaries |
| [`quiet-time-editor.html`](mockups/quiet-time-editor.html#new) | New quiet time | Frontend: Quiet-time editor | Quiet Times (Crossing midnight; acceptance: 11:00 PM to 7:00 AM Mon/Wed/Fri) |
| [`quiet-time-editor.html`](mockups/quiet-time-editor.html#picker) | Time picker open | Frontend: Quiet-time editor (start and end pickers) | Quiet Times (15-minute steps) |
| [`quiet-time-editor.html`](mockups/quiet-time-editor.html#same-day) | End after start (same day) | Frontend: Quiet-time editor | Quiet Times |
| [`quiet-time-editor.html`](mockups/quiet-time-editor.html#edit) | Editing an existing quiet time | Frontend: Quiet-time editor (delete when editing) | Quiet Times |
| [`quiet-time-editor.html`](mockups/quiet-time-editor.html#scope-save) | Save: just this day or all days? | Frontend: Quiet-time editor ("Just this day" / "All days in this set") | Quiet Times (Editing) |
| [`quiet-time-editor.html`](mockups/quiet-time-editor.html#scope-delete) | Delete: just this day or all days? | Frontend: Quiet-time editor (applies to save and delete) | Quiet Times (Editing) |
| [`quiet-time-editor.html`](mockups/quiet-time-editor.html#overlap) | Overlap blocked | Frontend: Quiet-time editor (findOverlaps; "same message from a backend 409") | Quiet Times (Overlaps are blocked; acceptance) |
| [`quiet-time-editor.html`](mockups/quiet-time-editor.html#no-days) | No day picked | Frontend: Quiet-time editor; Backend: Quiet times module (days) | Quiet Times |
| [`quiet-time-editor.html`](mockups/quiet-time-editor.html#same-time) | Start and end are the same | Frontend: Quiet-time editor; Backend: Quiet times module (start != end) | Quiet Times |
| [`quiet-time-editor.html`](mockups/quiet-time-editor.html#saving) | Saving | Frontend: Quiet-time editor | Quiet Times |
| [`quiet-time-editor.html`](mockups/quiet-time-editor.html#save-error) | Can't reach Hushmate | Frontend: Quiet-time editor; Important Failure Modes | States and Boundaries |
| [`nudge-sheet.html`](mockups/nudge-sheet.html#sheet) | Nudge sheet: default | Frontend: Nudge sheet | Nudging (the kernel) (Nudge opens a list of all housemates) |
| [`nudge-sheet.html`](mockups/nudge-sheet.html#sheet-away) | Nudge sheet: a housemate is away | Frontend: Nudge sheet (disabled and marked "away") | Nudging (the kernel) (away appear but can't be nudged); States and Boundaries (Away housemate) |
| [`nudge-sheet.html`](mockups/nudge-sheet.html#confirm) | Confirm: they are resting right now | Frontend: Nudge sheet (confirm dialog); Shared UI components > ConfirmDialog | Nudging (the kernel) (confirmation; acceptance) |
| [`nudge-sheet.html`](mockups/nudge-sheet.html#sending) | Sending | Frontend: Nudge sheet | Nudging (the kernel) |
| [`nudge-sheet.html`](mockups/nudge-sheet.html#sent) | Sent: toast, then cooldown | Frontend: Nudge sheet (toast, CooldownPill) | Nudging (the kernel) (Limit; countdown; toast copy) |
| [`nudge-sheet.html`](mockups/nudge-sheet.html#cooldown-reload) | Cooldown after a reload | Frontend: Nudge sheet ("After a reload or on another device") | Nudging (the kernel) (Limit) |
| [`nudge-sheet.html`](mockups/nudge-sheet.html#alone) | A house with only you | Frontend: Nudge sheet ("There's nobody to nudge yet.") | States and Boundaries (A house with only you) |
| [`nudge-sheet.html`](mockups/nudge-sheet.html#err-429) | Cooldown still running (429) | Frontend: Nudge sheet; Backend: Nudges module (429 {cooldownUntil}) | Nudging (the kernel) (Limit; acceptance: blocked, countdown visible) |
| [`nudge-sheet.html`](mockups/nudge-sheet.html#err-net) | Couldn't send | Frontend: Nudge sheet; Important Failure Modes | States and Boundaries |
| [`nudge-overlay.html`](mockups/nudge-overlay.html#overlay) | Overlay: default | Frontend: Nudge overlay | Acknowledging a Nudge (Recipient) |
| [`nudge-overlay.html`](mockups/nudge-overlay.html#overlay-long) | Overlay: the longest message | Frontend: Nudge overlay | Nudging (the five messages) |
| [`nudge-overlay.html`](mockups/nudge-overlay.html#overlay-demo) | Overlay: a demo nudge | Frontend: Nudge overlay (subtitle when present) | Demo House (Simulated nudges) |
| [`nudge-overlay.html`](mockups/nudge-overlay.html#overlay-busy) | Overlay: saying Got it | Frontend: Nudge overlay (one overlay covers all pending nudges) | Acknowledging a Nudge (several waiting: one overlay) |
| [`nudge-overlay.html`](mockups/nudge-overlay.html#overlay-err) | Overlay: could not acknowledge | Frontend: Nudge overlay; Important Failure Modes | States and Boundaries |
| [`nudge-overlay.html`](mockups/nudge-overlay.html#push-nudge) | Notification: a nudge | Frontend: Service worker; Backend: Push module | Notifications; Acknowledging a Nudge |
| [`nudge-overlay.html`](mockups/nudge-overlay.html#push-demo) | Notification: a demo nudge | Frontend: Service worker; Backend: Push module (nudge payload) | Demo House (Simulated nudges) |
| [`nudge-overlay.html`](mockups/nudge-overlay.html#push-join) | Notification: join approved | Frontend: Service worker (join-approved); Backend: Push module | Notifications |
| [`summary.html`](mockups/summary.html#default) | Summary: default | Frontend: Summary | Summary Board (all four areas) |
| [`summary.html`](mockups/summary.html#toast) | Toast when the sender opens the app within an hour | Frontend: Summary (toastedAcks) | Acknowledging a Nudge (Sender) |
| [`summary.html`](mockups/summary.html#two-acks) | Two acknowledgements in 24 hours | Frontend: Summary | Acknowledging a Nudge (Sender; 24 hours) |
| [`summary.html`](mockups/summary.html#streak-0) | Streak: 0 (a nudge just happened) | Frontend: Summary > Quiet Streak tile | Summary Board (acceptance: streak shows 0, no name) |
| [`summary.html`](mockups/summary.html#streak-1) | Streak: 1 day (singular) | Frontend: Summary > Quiet Streak tile | Summary Board |
| [`summary.html`](mockups/summary.html#streak-demo) | Demo house: streak fixed at 10 | Frontend: Summary ("When isDemo, it adds the demo note") | Demo House (Quiet Streak is fixed at 10 days; bots acknowledge) |
| [`summary.html`](mockups/summary.html#empty-both) | Nobody resting now, no heads-ups | Frontend: Summary | States and Boundaries (Nobody resting now; No heads-ups) |
| [`summary.html`](mockups/summary.html#no-house) | No active house yet | Frontend: Summary > App shell and routing | States and Boundaries (Waiting for approval) |
| [`summary.html`](mockups/summary.html#loading) | Loading | Frontend: Summary | Look and Feel (Motion) |
| [`summary.html`](mockups/summary.html#error) | Can't reach Hushmate | Frontend: Summary (refetches every 30 seconds); Important Failure Modes | States and Boundaries |
| [`summary.html`](mockups/summary.html#post-empty) | Post sheet: empty | Frontend: Summary > Post heads-up sheet | Summary Board (200 characters, counter) |
| [`summary.html`](mockups/summary.html#post-typing) | Post sheet: typing | Frontend: Summary > Post heads-up sheet | Summary Board |
| [`summary.html`](mockups/summary.html#post-max) | Post sheet: at the limit | Frontend: Summary (200-character counter) | Summary Board (acceptance: longer than 200 not possible) |
| [`summary.html`](mockups/summary.html#post-past) | Post sheet: time already passed | Frontend: Summary ("only allows future times") | Summary Board |
| [`summary.html`](mockups/summary.html#post-busy) | Post sheet: posting | Frontend: Summary | Summary Board |
| [`summary.html`](mockups/summary.html#post-err) | Post sheet: can't reach Hushmate | Frontend: Summary; Important Failure Modes | States and Boundaries |
| [`demo-welcome.html`](mockups/demo-welcome.html#welcome) | Welcome card over the Schedule | Frontend: Demo welcome card | Demo House (Welcome card); Core Journey B.2 |
| [`houses.html`](mockups/houses.html#default) | Houses: all four card types | Frontend: Houses > House cards | Houses and the Active House (House cards) |
| [`houses.html`](mockups/houses.html#owner) | Owner: join requests | Frontend: Houses (Requests, Approve, Decline) | Houses and the Active House (owner accepts or declines; acceptance) |
| [`houses.html`](mockups/houses.html#toast) | Toast: invite link copied | Frontend: Houses (Copy invite link) | Houses and the Active House |
| [`houses.html`](mockups/houses.html#switched) | Make active: the cards re-sort | Frontend: Houses (Make active) | Houses and the Active House (acceptance: Make active) |
| [`houses.html`](mockups/houses.html#create) | Create house sheet | Frontend: Houses > CreateHouseSheet | Accounts (Name rules); Houses and the Active House |
| [`houses.html`](mockups/houses.html#create-err) | Create house sheet: spaces or # in the name | Frontend: Houses > CreateHouseSheet | Accounts (Name rules) |
| [`houses.html`](mockups/houses.html#join-found) | Join by ID sheet: house found | Frontend: Houses > JoinByIdSheet | Houses and the Active House (Join) |
| [`houses.html`](mockups/houses.html#join-404) | Join by ID sheet: not found / already requested | Frontend: Houses > JoinByIdSheet | Houses and the Active House |
| [`houses.html`](mockups/houses.html#demo) | Demo account: one house, no controls | Frontend: Houses ("Demo accounts see the demo house only") | Demo House (Demo accounts are locked) |
| [`houses.html`](mockups/houses.html#empty) | No houses yet | Frontend: Houses | Houses and the Active House |
| [`houses.html`](mockups/houses.html#loading) | Loading | Frontend: Houses | Look and Feel (Motion) |
| [`houses.html`](mockups/houses.html#error) | Can't reach Hushmate | Frontend: Houses; Important Failure Modes | States and Boundaries |
| [`profile.html`](mockups/profile.html#default) | Profile: notifications off | Frontend: Profile | Profile and Theme (Notifications row; acceptance) |
| [`profile.html`](mockups/profile.html#on) | Profile: notifications on | Frontend: Profile | Profile and Theme (theme; acceptance: applies immediately) |
| [`profile.html`](mockups/profile.html#denied) | Profile: notifications blocked | Frontend: Profile | Notifications; States and Boundaries |
| [`profile.html`](mockups/profile.html#ios) | Profile: iPhone, not on the Home Screen | Frontend: Profile ("plus the guidance for that state") | Profile and Theme (Notifications row); Onboarding |
| [`profile.html`](mockups/profile.html#unsupported) | Profile: not available | Frontend: Profile | States and Boundaries (Notifications off or not installed) |
| [`profile.html`](mockups/profile.html#demo) | Demo account | Frontend: Profile; Backend: Auth module (no credential-change endpoints) | Demo House (Demo accounts are locked) |
| [`profile.html`](mockups/profile.html#signing-out) | Signing out | Frontend: Profile > Sign out (steps 1 to 4) | Profile and Theme; Demo House (Signing out stops them on that device) |
| [`join-link.html`](mockups/join-link.html#out) | Signed out | Frontend: Join by link | Onboarding (invite link remembered); Onboarding (An invite link opened while signed out) |
| [`join-link.html`](mockups/join-link.html#in) | Signed in | Frontend: Join by link ("Request to join") | Houses and the Active House (Join) |
| [`join-link.html`](mockups/join-link.html#busy) | Requesting | Frontend: Join by link | Houses and the Active House |
| [`join-link.html`](mockups/join-link.html#sent) | Request sent | Frontend: Join by link (Onboarding > Start, "Request sent") | Onboarding |
| [`join-link.html`](mockups/join-link.html#404) | Invite link not found (404) | Frontend: Join by link | Houses and the Active House |
| [`join-link.html`](mockups/join-link.html#demo) | Demo house refuses (403) | Frontend: Join by link ("This is a demo house") | Demo House (join requests refused) |
| [`join-link.html`](mockups/join-link.html#409) | Already a member or already asked (409) | Frontend: Join by link; API 409 | Houses and the Active House |

## Decisions (design review 2026-10-04)

The first pass of these mockups listed 20 calls and conflicts. The user ruled on them on 2026-10-04; the numbers below are the original numbers. Nothing in `devpost/` was edited by the design pass; spec and PRD are being updated separately.

### Changed in this round

9. **Onboarding is split into two parts (replaces the single 3-step flow).** See `mockups/onboarding.html`.
   - **Part 1, Start** (`/onboarding`, someone with no houses): choose Create or Join. Create leads to "House created" (shows `MapleHouse#482913` and Copy invite link) and continues straight into Part 2, because the creator is approved at once. Join (by ID or by invite link) ends at a **"Request sent"** screen and nothing else: no quiet times, no notification setup, no "hear when you're approved" offer. Its one button, "Go to Schedule", lands on the waiting-for-approval empty state. The create and join error frames are kept. Part 1 has no progress bar.
   - **Part 2, Setup** (`/onboarding/setup/:houseId`): runs for any approved membership whose setup is not done, so right after creating a house, or on the first app open after a request is approved (also for houses joined later, not only the first). Joiners see an intro first ("You're in MapleHouse"); creators skip it. Then step 1 optional quiet times (empty and added frames, skippable) and step 2 notification setup (all push states, including the iPhone Add to Home Screen and "sign in again" step). **Step 2 is skipped when notifications are already On.** Finish goes to Schedule. The progress bar has two segments: Quiet times, Notifications.
   - The waiting-for-approval empty state on Schedule and the "no active house" mirror on Summary now say "Once you're in, you'll set up your quiet times." (one button each).
   - Spec cited: `Frontend: Onboarding` (Start / Setup). PRD cited: `Onboarding`.
15. **Toasts have a neutral dot** (`var(--hm-text-3)`) except the acknowledgement toast, which keeps the mint `--hm-ack` dot. Implemented as a `.toast.ack` modifier; no new colour.
16. **`--hm-border-control` changed** to `#6B77A9` (dark) and `#847D91` (light), so borders meet 3:1 against surface-2 as well as the page. `mockups/tokens.css` carries the change with a comment that it differs from `planning/design-system/tokens.css` by this decision; every page inlines the updated copy. The workaround of putting inputs inside sheets on a surface-1 fill is **reverted**: inputs are surface-2 everywhere, as in the design system. This is the **only** value in `tokens.css` that differs from the planning file. (The other half of the old note stands as known and accepted: peach, mint and butter fills and the housemate pastels are 1.2 to 1.9:1 against Paper or white in light mode, but each carries a text label at 9.3 to 13.3:1, and "away" is carried by the outline plus the word.)
14. **House names cannot contain spaces** (2 to 30 characters, no spaces, no `#`). Every sample house is renamed (`MapleHouse`, `BirchwoodFlats`, `CedarCourt`, `WillowLane`) in headers, cards, IDs, copy, toasts and notifications ("You're in! MapleHouse approved your request."). **`DevPost Demo House` stays as is** (it is seeded, not user-created). The create-house frames (onboarding and Houses) show the error "House names can't have spaces or #." The join-by-ID placeholder stays `MapleHouse#482913`.
**D. Overlay motion** (a correction to the old section D, not a numbered item). The nudge overlay card rises 8px (`--hm-rise`), not 16px. Frame note and section D updated.

### Confirmed as drawn (no change)

1. **Week view:** thin stripes per person, a legend with names (and "(away)"), and tap a day to open the day view.
3. **Schedule controls:** the + button (Add quiet time), previous and next day arrows with the date, and the Day / Week control.
4. **No read-only view of an inactive house's quiet times.** The PRD criterion "viewed but not edited" is being dropped, so nothing is designed for it.
6. **"Resting now" excludes you.**
11. **"Not resting"** wording in the nudge sheet (not "Awake").
12. **The acknowledgement card names who tapped Got it** ("Jordan tapped Got it · 4 min ago"). This is now a promised PRD behaviour. It is shown only to the sender.

## Still open (my call stands unless you say otherwise)

2. **More than four people:** lanes have a 76px minimum and the lane area scrolls sideways with the hour gutter fixed (the demo house has six members).
5. **No-house states:** besides the Schedule state, I mirrored it on Summary and added "No houses yet" on Houses; the PRD names only the Schedule one.
7. **Several nudges waiting:** one overlay with one message and no count. Which message (newest or oldest) is unspecified.
8. **Short overnight segments** at the bottom of a day (30px high) show only the name; the tall segment carries the time range. The app should give both an accessible name with the full range.
10. **"Copy invite link" placement:** a ghost button on every approved house card, on "House created", and in the "nobody to nudge yet" empty state.
13. **Heads-up over the limit:** the field hard-stops at 200 and the counter turns bold (the design system's 214-character error sample is unreachable).
17. **Logo lavender vs brand lavender in light mode:** the kit's light wordmark is `#6E66E0`, the token is `#5F57D4`. I used the kit files untouched.
18. **Day view length:** 24 hours (the design system's example is 8 pm to 8 am). The app should open scrolled to the now line.
19. **Hour height:** compressed to 30px in the mockup so the day fits one frame; the app should use 48px and scroll.
20. **Empty states have one button.** The waiting-for-approval state dropped its second route; Houses holds the request list.

### C. Copy I wrote that the docs do not supply

The docs give: the five nudge messages, the demo subtitle, "Nudge sent quietly", "Who's being loud?", "Nudge again in 4:32", "There's nobody to nudge yet.", the overlap message, the welcome card, the streak note, "No quiet times yet", "Add quiet time", "You're in! {House} approved your request.", the iPhone steps, "Can't reach Hushmate right now", "Your nudge was acknowledged", "This is a demo house", "Totally optional", "Pending approval", "Declined" and "Make active". The review round also supplied the "Request sent" and "You're in MapleHouse" lines, the "Once you're in, you'll set up your quiet times" caption and "House names can't have spaces or #." Everything else is mine and needs a read-through:

- Sign in and sign up: "That email and password don't match.", "Too many tries / Give it a minute, then try again.", "That email already has an account. Try signing in instead.", helper lines ("Housemates only ever see your name.", "Only you see your email. Housemates never do.").
- Landing: "Share your quiet times with your housemates. When it gets loud, nudge them gently. They'll never know it was you." and "Works right in your browser. Nothing to install."
- House flows: "We couldn't find that house. Check the name and number and try again.", "You've already asked to join MapleHouse, or you're in it.", "This link doesn't work", "You're on the list", "No houses yet", "MapleHouse is ready", "Let's go" (the Setup intro button), "BirchwoodFlats is now your active house", "Invite link copied", "Use at least 2 characters."
- Notification setup: "Hear about nudges", and the denied, unsupported and "Couldn't turn on notifications" lines.
- Nudge: the resting confirmation ("Jordan is resting right now. Their quiet time runs until 4:30 AM. They won't know it was you. Nudge anyway?"), "Easy does it. You can nudge again in 3:10.", "Couldn't send that nudge".
- Quiet-time editor: "Change which days?", "Delete this quiet time?", "Just this day (Wed)", "All days in this set", "Days are the nights it starts. This one ends the next morning.", "Pick at least one day.", "Start and end can't be the same time."
- Summary: "The house is wide awake", "No heads-ups yet", "Late dinner? Friends coming over? Let the house know.", "A nudge happened, so the count starts again.", the Post sheet's helper lines, heads-up time chips ("Today · 11:30 PM", "Tomorrow · 8:00 PM").
- Demo: the welcome card's heading and the "Show me around" button (lavender on purpose; mint is reserved for Got it).

### D. Mockup-only simplifications (not for the build)

- The status bar, phone corner radius and the dimmed underlay behind each sheet are decoration. Underlays are cropped to the evening with a fixed 844px frame.
- Sheets, overlays and the streak count-up are not animated; the frame notes give the timing from the design system (sheets rise 24px and fade over 400ms, the overlay card rises 8px, the streak counts up over 700ms).
- A native `<input type="time" step="900">` is an acceptable substitute for the wheel pickers in the editor.
- Sample data: the house is "MapleHouse" on Thursday Oct 8 with Maya, Jordan and Priya using the demo bots' schedules from `spec.md`; it is not the demo house.

