---
doc: prd
status: approved
---

# Hushmate: Product Requirements

*Less shush, more hush.* A hosted, mobile-first PWA where housemates, students in shared housing first, share their quiet times and can nudge each other anonymously, with the app itself as the messenger.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

**Labels used below:**
- *(Assumption: confirm)*: the agent filled a small gap; the learner hasn't ruled on it yet.
- *(Design spec: confirm)*: a detail from `../planning/design-system/` that the learner has seen but hasn't ruled on individually.

Everything else is the learner's decision.

**Approved 2026-10-03.** At review the learner confirmed every item labelled *Assumption*, *agent suggestion* or *Design spec*. The labels stay to show where each detail came from.

## The Core Journey

**A. A new user (a real house).** Develops `scope.md > The Core Loop`.
1. Open the link. The landing page offers **Sign up** or **Sign in**. There's nothing to install.
2. Sign up with **name, email and password**.
3. Onboarding asks you to **create a house** or **join one**, by invite link or by searching a house ID like `MapleHouse#482913`.
4. A join request waits for the house owner to accept it. Creating a house needs no approval.
5. Once you're in a house, onboarding offers to **set your first quiet times**. This is optional and can be skipped.
6. If this is your first house, it becomes your **active house**.
7. Onboarding guides you to **turn on notifications**. On iPhone that means adding Hushmate to the Home Screen first.
8. You land on **Schedule**: today's calendar, with each housemate's quiet times side by side and a **Nudge** button.
9. Day to day, you check **who's resting now** and post **heads-ups** ("coming home late, might make late dinner") on the **Summary** board.
10. When someone is being loud, you tap **Nudge**, pick who it is, and the app sends them a gentle reminder **in its own voice**. They never learn it was you.
11. They see the reminder and tap **Got it**. You see quietly that it was acknowledged.
12. Every day with no nudges grows the house's **Quiet Streak**.

**B. A judge (a demo account).** Develops `scope.md > What "Working" Looks Like`.
1. Open the link and sign in with one of three **demo accounts** (email and password listed on the Devpost page and in the README).
2. A **welcome card** explains DevPost Demo House: three simulated housemates, and nudges that arrive often.
3. Onboarding guides you to turn on notifications on this device.
4. See the house on **Schedule**. One simulated housemate has a morning quiet time.
5. Nudge a housemate: a simulated one, or another judge logged into a different demo account.
6. Within **10 minutes** you receive a **Demo** nudge as a real notification.
7. Open it and tap **Got it**.
8. More Demo nudges follow every 30 minutes to 2 hours until you log out.

**Success:** a gentle, anonymous nudge arrives as a real notification on someone's own device, they acknowledge it, and the sender quietly learns it landed. Nobody else in the house knows it happened.

## Screens and Layout

**Before sign-in:**
- **Landing:** Sign up / Sign in.
- **Onboarding** (first run): create or join a house → optional first quiet times → notification setup.

**After sign-in**, a bottom tab bar: **Schedule · Summary · Houses · Profile** *(tab labels: Design spec: confirm)*.

| Surface | What's on it |
|---|---|
| **Schedule** (home) | Calendar **day view** (default), switchable to **week view**. One lane per person, so overlapping quiet times sit side by side. A "now" line. A floating **Nudge** button at the bottom right *(position: Design spec: confirm)*. Adding or editing a quiet time opens the **quiet-time editor**. |
| **Summary** | A message board: the **Quiet Streak** tile, **Resting now**, **heads-up** cards and a way to post one, and (sender only) cards showing your nudge was acknowledged. |
| **Houses** | Your house cards (Active at the top, then Inactive, Pending, Declined), **Create house**, **Join** by invite link or ID search, and join requests waiting for you, if you own a house. |
| **Profile** | Your name and email, the **theme** setting (follow device, or a manual light or dark choice), and **Sign out**. |

**Overlays and sheets:**
- the **nudge picker** ("Who's being loud?" bottom sheet, *title: Design spec: confirm*)
- the **confirmation** when nudging someone in their quiet time
- the **nudge overlay** with **Got it** (recipient)
- the **demo welcome card**
- **toasts**

## Look and Feel
Decided by the learner in the branding session (2026-10-03). Sources: `../planning/branding-hushmate.md`, `../planning/design-system/design-system.md`, `../planning/design-system/tokens.css` (the source of truth for values), and `../planning/logo/kit/`.

- **Name:** Hushmate. **Tagline:** "Less shush, more hush."
- **"Cozy midnight":** dark pastels on a Night navy base (`#121A33`). **Flat**: no gradients, no shadows, no mascot. Typography carries the personality.
- **Type:** **Fredoka** for the logo, headings, and **anything the app says to you** (nudges, the overlay, empty-state headlines). **Nunito** for all other interface text.
- **Modes:** dark and light. Dark is designed first. The theme follows the device by default, with a manual override in Profile.
- **Colour has jobs:** **peach = nudge**, **mint = Got it**, **butter = Quiet Streak**, lavender = primary action and **"you"**. Each housemate gets their own pastel (sky, rose, sage, aqua, orchid).
- **Filled vs outlined:** a filled block means the quiet time counts in this house now. An outlined block means that person is **away** (another house is active), and it's also labelled "away".
- **Motion:** "soft fades but make it feel alive". Gentle fades with no bounce, a slow **breathing ring** around anyone resting now, and the Quiet Streak **counting up**. The device's reduce-motion setting is respected.
- **Voice:** the app speaks in the third person and is warm, brief and a little playful. It **never names the sender**. Example: "Nudge sent quietly." Not: "Sam says you're too loud."
- **Empty states invite rather than apologise**, e.g. "No quiet times yet" → **Add quiet time**.
- **The demo gets no special UI.** "It will look like a school project." Demo accounts use the normal sign-in.

## Features and Behavior

### Accounts and Sign-In
Develops `scope.md > The POC Boundary` ("signing up as a house").
- Sign up with name, email and password, and sign in with email and password.
- **Housemates only ever see each other's names.** Avatars are the initial on the person's pastel; there are no photos.
- [ ] A new account can sign up, sign out and sign back in, and lands where it left off.
- [ ] No screen shows a housemate's email.

### Onboarding
Develops `scope.md > What "Working" Looks Like` ("onboarding shows how to turn on browser notifications").
- First run: create a house or join one → optional first quiet times (skippable) → notification setup.
- Joining your **first** house makes it active automatically at the end of onboarding. A house joined later starts **inactive** *(Assumption: confirm)*.
- Notification setup explains the iPhone step: notifications need Hushmate added to the Home Screen.
- **While a join request is pending,** onboarding offers notification setup right after you send the request, so you can hear when you're approved *(Assumption: confirm)*.
- [ ] A first-time user can go from sign-up to the Schedule screen of a house they created, without leaving the flow.
- [ ] Skipping quiet-time setup still completes onboarding.
- [ ] The notification step shows iPhone-specific Home Screen guidance.

### Houses and the Active House
Develops `scope.md > The POC Boundary` ("multiple groups per person, with one active at a time").
- **Create a house:** you pick a name, and the app assigns a unique ID in the form **`Name#123456`** (Riot-ID style) *(composition: Assumption: confirm)*.
- **Join a house** by **invite link** or by **searching its ID**. Either way sends a **join request** that the **owner accepts or declines** in the Houses tab *(both routes needing approval: Assumption: confirm)*. The owner isn't notified; they see requests in Houses.
- In the PoC, the **owner's only extra power** is accepting or declining requests *(Assumption: confirm)*.
- **House cards:**
  - **Active:** sorted to the top, with a lavender border and badge.
  - **Inactive:** has **Make active**.
  - **Pending:** dashed border, "Pending approval".
  - **Declined:** "Declined", dismissible *(Assumption: confirm)*.
- **Exactly one active house.** Switching never removes you from other houses.
- **What "active" means:**
  - You can only nudge, and be nudged by, people whose active house is the same as yours.
  - Your quiet times show as **filled** in your active house and **outlined ("away")** in your other houses.
- [ ] Creating a house shows its `Name#123456` ID, and a second house with the same name gets a different number.
- [ ] A join request appears to the owner. Accepting it moves the requester's card from Pending to their house list; declining shows "Declined".
- [ ] Tapping **Make active** moves that house to the top as Active, and the previous one becomes Inactive.
- [ ] After switching, the other house's housemates see your quiet times outlined and marked "away".

### Quiet Times
Develops `scope.md > The Core Loop` ("set your weekly quiet times… they can differ by day").
- Quiet times are **per house** and **optional**. Someone not bothered by noise can join without any, "to be mindful of other housemates' needs".
- **The editor** (in the style of iOS Reminders):
  - a **start time** and an **end time**, in **15-minute steps**
  - the **days** it applies to, Monday to Sunday
  - Saving creates one **quiet-time set**.
- **Crossing midnight:** if the end time is earlier than the start time, the quiet time **ends the next morning**, shown as "11:00 PM → 7:00 AM (next day)". The days you pick are the nights it **starts** on, and the day view draws both parts as one quiet time *(agent suggestion: confirm)*.
- **Editing** a quiet time that's part of a set asks: **just this day, or all days in this set?** "Just this day" splits that day off into its own quiet time *(split behaviour: Assumption: confirm)*.
- You can add, edit and delete quiet times **only in your active house**, with one exception: the optional setup step when you join a house.
- [ ] Creating "11:00 PM → 7:00 AM, Mon/Wed/Fri" shows a block on those nights that continues into the next morning in the day view.
- [ ] Editing one day of a set and choosing "just this day" changes only that day; "all days" changes every day in the set.
- [ ] Times can only be picked in 15-minute steps.
- [ ] Quiet times in an inactive house can be viewed but not edited.

### Schedule (Calendar)
Develops `scope.md > The Core Loop` ("open the app to see who's resting now").
- The **day view** is the home screen, with a **week view** toggle. There's **no month view**.
- One lane per person, so overlapping quiet times sit side by side. Each block shows the name and time range in that person's pastel. "You" are always lavender.
- A "now" line marks the current time.
- [ ] With three housemates whose quiet times overlap, the day view shows all three side by side without hiding any.
- [ ] Switching between day and week keeps the same house and date.

### Nudging (the kernel)
Develops `scope.md > The Unique Kernel`.
- **Nudge** opens a list of **all housemates** in your active house.
  - Housemates who are **away** appear but can't be nudged *(Assumption: confirm)*.
  - You can't nudge yourself.
- If the person you pick is **currently in their quiet time**, a **confirmation** asks before sending. This prevents accidentally nudging someone asleep while still allowing it, for example when A's quiet time starts at 10pm but A is still up and loud.
- **You can nudge at any time**, not only during your own quiet time.
- **Message:** the app picks one at random ("Duolingo vibes") from the learner's five (picks 1, 2, 4, 5 and 6 from the suggested list):
  1. "Someone in the house is resting right now. Could you bring the volume down a little?"
  2. "Gentle heads-up: noise is carrying right now. A little quieter would go a long way."
  3. "Psst, sound travels further than you'd think. Someone nearby could use some quiet."
  4. "A quick reminder from your house: someone's winding down. Mind turning it down a notch?"
  5. "Your housemates would appreciate a calm space right now. Could you keep it down a bit?"
- After sending, a toast confirms it, e.g. "Nudge sent quietly" *(copy: Design spec: confirm)*.
- **Limit:** one nudge every **5 minutes** per sender, across all housemates. The button shows a countdown ("Nudge again in 4:32") *(per sender: Assumption · countdown: Design spec: confirm)*.
- **Anonymity:** the recipient is never told who sent it. **Only the sender and the recipient know a nudge happened between them.** Nothing in the house's shared views lists nudges, senders or recipients. This holds in a two-person house too: the wording always comes from the app.
- [ ] Nudging a housemate who isn't resting sends it immediately and shows the toast.
- [ ] Nudging someone in their quiet time shows a confirmation first, and cancelling sends nothing.
- [ ] A second nudge within 5 minutes is blocked, and the countdown is visible.
- [ ] The recipient's message never contains the sender's name.
- [ ] Across many nudges, the recipient sees more than one of the five messages.

### Acknowledging a Nudge
Develops `scope.md > The Core Loop` ("they can reply 'got it', also anonymously").
- **Recipient:** if notifications are on, a notification arrives. Tapping it, or simply opening the app, shows an **overlay** with the app icon, the message (in the app's Voice type) and a full-width mint **Got it** button. The overlay must be acknowledged to dismiss it. **Without notifications, the overlay still appears on the next open.**
- If several nudges are waiting, one overlay is shown, and **Got it** acknowledges them all *(Assumption: confirm)*.
- **Sender:** finds out quietly. **There's no notification.**
  - A card on their **Summary** says the nudge was acknowledged. Only the sender sees it, and it stays for **24 hours** *(duration: Assumption: confirm)*.
  - A **toast** appears if they open the app **within 1 hour** of the acknowledgement.
- [ ] Opening the app after being nudged shows the overlay before anything else, and **Got it** dismisses it.
- [ ] The sender sees "acknowledged" on their Summary; no other housemate sees anything.
- [ ] A sender who opens the app within an hour of the acknowledgement sees a toast.

### Summary Board
Develops `scope.md > The Core Loop` ("give a heads-up…", "the house's quiet streak").
- **Quiet Streak:** the number of days since **anyone in the house was nudged**, shown as a big number that counts up. The learner accepted the tradeoff: any nudge resets it, but **nobody knows who broke it**.
- **Resting now:** housemates currently in a quiet time in this house, each with the breathing ring.
- **Heads-ups:**
  - **free text up to 200 characters**, with **a time attached**
  - shows the **author's name** (unlike nudges)
  - **no notification**
  - disappears once its time has passed *(Assumption: confirm)*
- **Your acknowledged nudges** (sender only; see above).
- [ ] Posting a heads-up longer than 200 characters isn't possible, and the field shows a character count.
- [ ] A posted heads-up shows the author's name and time to every housemate in that house.
- [ ] After a nudge, the house's Quiet Streak shows 0, without naming anyone.
- [ ] Someone whose quiet time is in progress appears under Resting now.

### Notifications
Develops `scope.md > What "Working" Looks Like`.
- **Only two notifications exist:** **you've been nudged**, and **your join request was approved**. There are no reminders, heads-up alerts, acknowledgement alerts or owner alerts.
- Declining notifications is the user's choice, and the app stays fully usable.
- [ ] With notifications enabled, a nudge arrives as a system notification while the app is closed.
- [ ] No other action in the app produces a notification.

### Profile and Theme
- Shows your name and email, **theme** (follow device, light or dark) and **Sign out**.
- [ ] Changing the theme applies immediately and persists after signing out and back in.
- [ ] By default, the theme matches the device's light or dark setting.

### Demo House
Develops `scope.md > What "Working" Looks Like` (the demo).
- **DevPost Demo House** has six members:
  - **3 simulated ("bot") housemates** who feel like real people. They have names, weekly quiet times (one has a **morning** quiet time) and heads-ups on the board. The agent will propose names and schedules for the learner to change.
  - **3 demo accounts for judges.** Judges sign in with an email and password listed on the Devpost page and in the README. Two judges on different demo accounts can nudge each other for real.
- **Demo accounts are locked.** They can't:
  - change their name, email or password
  - delete the account
  - leave the demo house, create or join other houses, or switch the active house
- **People sharing a demo account share its nudges and edits.** The learner accepted this.
- **Nightly reset:** the demo house returns to its starting state every night. That covers quiet times, heads-ups, nudges and acknowledgements. Each reset gives the bots fresh heads-ups for the coming day *(fresh heads-ups: Assumption: confirm)*.
- **Simulated nudges:** the bots nudge each signed-in demo account. The first comes **within 10 minutes** of signing in (after notification setup), then at **random intervals of 30 minutes to 2 hours**, and they **never stop**. Each one carries a **"Demo"** label. Signing out stops them on that device *(Assumption: confirm)*.
- **Welcome card (option A)**, shown when a demo account signs in. Suggested copy: "Welcome to DevPost Demo House. [bot names] are simulated housemates. They'll nudge you every 30 minutes to 2 hours so you can feel how Hushmate works. Log out anytime to stop the nudges." *(copy: agent suggestion, confirm)*
- **Quiet Streak is fixed at 10 days**, with a note. Suggested copy: "This is a demo house, so its Quiet Streak is fixed at 10 days. In your own house, it counts the days since anyone was nudged." *(copy: agent suggestion, confirm)*
- [ ] Signing in with each of the three demo accounts lands in DevPost Demo House and shows the welcome card.
- [ ] A Demo-labelled nudge arrives within 10 minutes of signing in, and the next arrives between 30 minutes and 2 hours later.
- [ ] Demo accounts can't reach any control that changes credentials, deletes the account, or leaves or switches houses.
- [ ] After the nightly reset, a quiet time a judge added the day before is gone, and the bots' schedules and fresh heads-ups are back.
- [ ] The demo house's Quiet Streak always shows 10 days, with its note.

## States and Boundaries
- **First use:** onboarding (create or join → optional quiet times → notifications).
- **Waiting for approval:** no active house yet. Houses shows the Pending card, and Schedule shows an empty state inviting you to create a house or wait *(Assumption: confirm)*.
- **No quiet times yet:** "No quiet times yet" → **Add quiet time**.
- **Nobody resting now:** Summary says so warmly rather than leaving a blank space.
- **No heads-ups:** an empty state inviting you to post one.
- **A house with only you in it:** Schedule shows your lane only. **Nudge** has nobody to pick and says so *(Assumption: confirm)*.
- **Notifications off or not installed (iPhone):** everything works, and nudges appear as the overlay on the next open.
- **Join request declined:** the card shows "Declined", with no notification.
- **Nudge cooldown:** the Nudge button shows the countdown until the 5 minutes are up.
- **Away housemate:** outlined blocks labelled "away", and they can't be nudged.
- **Persistence:** accounts, houses, memberships, quiet times, heads-ups (until their time passes), streaks and acknowledgements persist. The demo house is reset nightly.

## Product Decisions
- **Mobile-first PWA, not native.** It's usable from a link with nothing to install. It's a PWA with no offline mode and no install prompts, just what notifications need (a service worker and, for the iPhone Home Screen, a manifest). A native app is a separate future iteration. *(2-scope; PWA scope clarified in 4-spec)*
- **Anonymous nudging is the kernel.** The app is the messenger, which keeps it anonymous even in two-person houses. *(2-scope, 3-prd)*
- **Name, email and password sign-up; housemates see only names.** Look into a third-party sign-in provider in `4-spec` to make signing in easier.
- **Join requests need the owner's approval**, so the house controls who sees its schedules.
- **One active house at a time.** "You don't want to be randomly pinged by housemate A when you're on vacation."
- **Away quiet times are outlined, not filled**, so presence is visible at a glance.
- **Quiet times are per house and optional.** People join "to be aware / mindful of other housemates' needs" even if noise doesn't bother them.
- **Edit only in your active house**, except during the setup step when you join.
- **Day and week views only.** Month view is deferred because weekly quiet times repeat, so a month adds little.
- **No "quiet time starting" reminders.** They'd be annoying; "if User A decides to take a nap outside their own scheduled quiet time, they might get startled".
- **Only two notifications:** nudged, and join approved.
- **Confirm before nudging someone in their quiet time,** but allow it, because their quiet time may have started while they're still up and loud.
- **Nudge at any time.**
- **Five rotating nudge messages**, picked at random ("Duolingo vibes"), so nudges don't feel like a form letter.
- **5-minute nudge limit** against spam.
- **The sender learns of the "got it" quietly** (Summary card plus a toast within an hour), never by notification.
- **Only the sender and recipient know about a nudge.** The streak shows that a nudge happened, never who sent it or who received it.
- **The Quiet Streak counts nudge-free days.** The learner accepted that any nudge resets it.
- **Heads-ups are free text (200 characters) with a time and the author's name, and send no notification.**
- **Demo uses 3 locked demo accounts plus 3 bots, reset nightly,** instead of a public join link that strangers could use to fill the house.
- **No special demo UI.** It "will look like a school project".
- **The demo streak is fixed at 10 days,** because simulated nudges make a real streak impossible.

## What We're Building
- A hosted, mobile-first PWA (no offline mode, no install prompts) with landing, sign up / sign in, and onboarding (create or join, optional quiet times, notification setup with the iPhone Home Screen step).
- Houses: create (with a `Name#123456` ID), join by link or ID search, owner approval, multiple houses with one active, Make active.
- Quiet times per house: the start/end editor with days, 15-minute steps, crossing midnight, "this day or all days" editing.
- Schedule: day view with side-by-side lanes, a now line, a week toggle, filled vs away (outlined) blocks.
- Nudging: the picker, confirmation for resting housemates, five random app-voice messages, the 5-minute limit, anonymity.
- Acknowledging: the overlay with **Got it**, and the sender's quiet confirmation (Summary card plus toast).
- Summary: Quiet Streak, Resting now, heads-ups (200 characters, time, author), and acknowledged-nudge cards.
- Notifications: nudged, and join approved.
- Profile: theme (device / light / dark) and sign out.
- Hushmate's look and feel as specified (dark and light).
- DevPost Demo House: 3 bots, 3 locked demo accounts, the welcome card, Demo-labelled simulated nudges, the fixed 10-day streak with its note, and a nightly reset.

## Deferred From the POC
These are implied by the product but not built now. Each one is named so it doesn't slip into the build.
- **Month view.** Weekly quiet times repeat; the learner deferred it.
- **Owner powers beyond accept/decline** (removing members, transferring ownership, deleting a house) *(Assumption: confirm)*.
- **Leaving a house** *(Assumption: confirm, not discussed)*.
- **Password reset and account editing** for normal accounts. These may come free with a third-party sign-in provider; `4-spec` decides *(Assumption: confirm)*.
- **Time zones across houses.** All houses are assumed to use the same local time for the PoC *(Assumption: confirm)*.

## Possible Later Enhancements
- **One-off quiet times** announced ahead, such as an interview or important call. *(scope: Later)*
- **Email notifications** as a fallback. *(scope: Later)*
- **A native phone app** for fuller notification support, as a separate iteration. *(scope: Later)*

## Non-Goals
- **Noise detection** (microphone, decibel meters, hardware). The person trying to rest decides what's disturbing. *(scope: Explicitly Cut)*
- **"Quiet time is starting" reminders.** Annoying, and they could startle someone napping. *(scope: Explicitly Cut)*
- **AI-proposed quiet hours** and **AI-reworded nudges.** Agent suggestions the learner didn't take up. *(scope: Explicitly Cut)*
- **Revealing who sent a nudge**, or showing nudge history, senders or recipients to the house. This would break the kernel.
- **A special demo login UI** (e.g. one-tap "Try as judge" buttons). The learner rejected it.
- **Penalties or leaderboards.** The identity is positive reinforcement, not enforcement. *(scope: Inspiration & Identity)*

## Open Questions
- **Third-party sign-in provider:** which one, and does it cover password reset? *Answer in `4-spec`; doesn't block PRD approval.*
- **Two of your own quiet times overlapping in the same house:** merge, warn or allow? *Can be decided during the build.*
- ~~Every labelled assumption, suggestion and design-spec item above.~~ *Resolved: all confirmed by the learner at review (2026-10-03).*
