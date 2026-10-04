---
doc: spec
status: approved
---

# Hushmate: Technical Spec

Implements `prd.md` (approved 2026-10-03, updated during `4-spec`). Kernel: `scope.md > The Unique Kernel` (anonymous nudging, with the app as the messenger).

**This spec is the complete architecture.** Implementers (including `5-build` subagents) work from it alone; there's no separate architecture folder. Supporting research, with sources and pitfalls, is in `docs/forge/research/`:
- `web-push.md`
- `scheduling-on-fly.md`
- `nestjs-auth.md`

Where this spec and a research file differ, **this spec wins**.

**Labels:**
- Unlabelled choices are the learner's decisions, including research defaults they accepted.
- *(Agent detail)* marks implementation detail derived from those decisions.
- *(Verify early)* marks something to confirm in the first build slices.
- **Verified 2026-10-03** against live docs and the npm and Docker registries: see `Decisions and Open Issues > Verification results`.

## How This Works, In Plain Language
Hushmate is three pieces plus a database.

1. **The web app** (`app/frontend/`, React).
   - It's what people see on their phone: the Schedule, Summary, Houses and Profile tabs.
   - It's a **PWA without the extras**: a **service worker** (the one small script the browser keeps alive for the site after the tab closes, so push notifications can reach it) and a **manifest** (the name and icon file iPhone needs before Hushmate can be added to the Home Screen). There's no offline mode and there are no install prompts.
   - It's hosted on **Vercel**.
2. **The backend API** (`app/backend/`, NestJS). This is a server that's always on, waiting to be asked. It:
   - checks passwords and hands out sign-in tokens
   - stores and serves houses, quiet times, nudges and heads-ups
   - **sends push notifications**
   - runs three small **timers**: send due Demo nudges (and let bots tap Got it), reset the demo house at 3 AM, and write a daily heartbeat

   It runs as **one always-on machine on Fly.io**.
3. **The database** is **Postgres on Supabase**, used purely as a database: think of a set of spreadsheets the backend reads and writes. Only the backend talks to it.

**A nudge, end to end:**
1. B taps **Nudge** and picks A.
2. The web app sends "nudge A" to the backend.
3. The backend checks that B and A share an active house and that B isn't in the 5-minute cooldown.
4. It saves the nudge with a randomly picked message and asks the push service in A's browser to deliver it.
5. A's phone shows a notification with the message only, never B's name.
6. When A opens Hushmate, the web app asks the backend "anything waiting for me?" and shows the overlay. **Got it** tells the backend.
7. The next time B opens the app (within an hour), B sees a quiet toast and a Summary card.

**Why this shape:**
- One backend owns all the rules, which is what keeps nudges anonymous and demo accounts locked.
- One database holds everything.
- There's no live-sync machinery. The web app re-checks when you open or refocus it, and a push brings the urgent thing, the nudge, instantly. While the app is on screen it also polls pending nudges every 15 s (Safari shows declarative pushes without waking the service worker, found in slice 4).

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

**A. A new user (a real house)**
1. **Open the link.** Vercel serves the web app, which registers the service worker. A signed-out visitor sees the landing page (Sign up / Sign in). An invite link (`/join/:inviteToken`) shows the house name first and is **remembered** through sign-up or sign-in. → `Frontend: App shell and routing`, `Frontend: Join by link`
2. **Sign up.** `POST /auth/signup {name, email, password}`. The backend hashes the password with argon2id, saves the user, and returns `{token, user}`. The token is a signed note saying "this is user 42", valid 30 days. The web app keeps it in local storage. → `Backend: Auth module`
3. **Create or join a house.**
   - **Create:** `POST /houses {name}`. The backend assigns `Name#123456` and makes you owner, approved, and active (if it's your first house).
   - **Join:** search `GET /houses/lookup?id=Name%23123456`, or continue the remembered invite. Then `POST /houses/:id/join` or `POST /invites/:token/join` creates a **pending** membership. → `Backend: Houses module`
4. **Wait for approval.**
   - The owner sees the request in Houses (`GET /houses/:id/requests`) and approves it (`POST /memberships/:id/approve`).
   - The backend marks it approved, assigns a housemate colour, makes it your active house if you have none, and sends the **"join approved" push**: "You're in! {House} approved your request." → `Backend: Push module`
   - While you wait, onboarding ends at **Request sent**. Nothing else is set up yet (design review 2026-10-04).
5. **Setup: optional first quiet times.** Setup runs right after creating a house, or on the first open after approval (`GET /houses` shows `setupDone: false`). `POST /houses/:id/quiet-times {days, startMinute, endMinute}`. Overlaps with your own quiet times are refused with the clashing day and time. → `Backend: Quiet times module`
6. **Turn on notifications.**
   - The push key is fetched when the screen opens. On a tap, the browser asks permission and subscribes, and the web app sends the subscription to `POST /push/subscriptions`.
   - On iPhone in Safari (not a Home Screen app), it shows the Add-to-Home-Screen steps instead, plus "then open Hushmate from your Home Screen and sign in again".
   - It's skipped when notifications are already on, and can be done later from **Profile > Notifications**. → `Frontend: Push setup`
   - Finishing or skipping setup calls `POST /memberships/:id/setup-done`. → `Frontend: Onboarding`
7. **Schedule.** The web app loads `GET /me` and the house's members and quiet times (`GET /houses/:id/board`) and draws the day view. "Resting now" and "away" are worked out on the phone. → `Frontend: Calendar`
8. **Heads-ups and Summary.** `POST /houses/:id/heads-ups {text, at}`. `GET /houses/:id/summary` returns the streak, live heads-ups, and your acknowledged nudges. → `Backend: Heads-ups and Summary module`
9. **Nudge.**
   - The web app confirms first if the recipient is resting.
   - `POST /nudges {recipientId}`. The backend validates, picks a message, saves it, then pushes to all the recipient's devices without making B wait.
   - The response includes `cooldownUntil`. After a reload, the countdown comes from `GET /me`. → `Backend: Nudges module (the kernel)`
10. **Got it.**
    - When the recipient's app opens or refocuses, it calls `GET /nudges/pending` and shows the overlay.
    - `POST /nudges/acknowledge` acknowledges everything waiting.
    - If the app is already open when the push arrives, the service worker messages the page and the overlay appears at once. → `Frontend: Nudge overlay`
11. **The sender learns quietly.** `GET /houses/:id/summary` includes the sender's acknowledgements from the last 24 hours. If one is less than an hour old and not yet toasted on this device, a toast shows. → `Frontend: Summary`
12. **Quiet Streak.** Worked out by the backend whenever Summary loads: whole Vancouver days since the house's last nudge.

**B. A judge (a demo account)**
1. Sign in with a demo account: `POST /auth/signin`. The user is flagged `isDemo`.
2. `GET /me` returns `isDemo` and `demo.botNames`, and the web app shows the **welcome card**. On that call, if the account has no bot nudge scheduled, the backend schedules one **1–10 minutes from now**. → `Backend: Me`, `Backend: Demo module`
3. Notification setup is the same as in A.6.
4. The **every-minute timer** claims each demo account whose bot nudge is due. A random bot "sends" a nudge marked `isDemo` through the nudge pipeline (a real push, cooldown skipped), then the next one is scheduled 30–120 minutes later.
5. Judges on different demo accounts can nudge each other (real nudges). When a judge nudges a bot, the bot taps **Got it** about a minute later, so the judge also sees the sender side.
6. **Sign out:** the web app deletes this device's push subscription (`DELETE /push/subscriptions`), or unsubscribes in the browser if that fails, then clears the token and cached data. That device stops receiving nudges.
7. **3:00 AM Vancouver:** the reset restores the demo house, keeping every account's ID. Bot nudges pause until the account next opens the app. → `Backend: Demo module`

## Stack
| Layer | Choice | Why | Docs |
|---|---|---|---|
| Language | **TypeScript** (frontend and backend) | The learner's choice | https://www.typescriptlang.org/docs/ |
| Frontend framework | **React 19** | The learner's choice | https://react.dev |
| Frontend build | **Vite 8** | Fast dev server, simple static build for Vercel | https://vite.dev/guide/ |
| Routing | **React Router 8** | Tabs, onboarding and `/join/:token` | https://reactrouter.com |
| Server data | **TanStack Query 5** | Re-checks the backend when the app regains focus. That's how "overlay on next open" and new heads-ups appear without live sockets | https://tanstack.com/query/latest |
| Styling | **CSS Modules + Hushmate `tokens.css`** | Keeps the cozy-midnight design exact. No UI kit restyling it | https://vite.dev/guide/features#css-modules |
| Accessible primitives | **Radix UI** (Dialog, Toast) | Unstyled, accessible sheets, dialogs and toasts | https://www.radix-ui.com/primitives |
| Icons | **lucide-react** | The design spec calls for Lucide-style rounded outline icons | https://lucide.dev |
| Fonts | **@fontsource/fredoka, @fontsource/nunito** | Self-hosted fonts: no Google request, CSP-friendly | https://fontsource.org |
| Dates | **date-fns 4** | Quiet-time and week maths | https://date-fns.org |
| Calendar | **Hand-built** | One lane per person and filled vs outlined blocks; libraries fight both | n/a |
| Backend framework | **NestJS 12**, scaffolded with the default **ESM** module system | The learner's choice. v12 defaults to ESM + Vitest | https://docs.nestjs.com, https://docs.nestjs.com/migration-guide |
| Validation | **class-validator + class-transformer** via a global `ValidationPipe` | Request validation and normalisation in DTOs | https://docs.nestjs.com/techniques/validation |
| Database access | **Prisma 7.10**: `prisma@7` (a **runtime dependency**, so migrations run in the image), `@prisma/client@7`, `@prisma/adapter-pg@7`, with `prisma.config.ts` | Typed schema, migrations, seed. **Pin `@7`:** npm's `latest` tag for `prisma` points at `8.0.0-rc.19` | https://www.prisma.io/docs, https://supabase.com/docs/guides/database/prisma |
| Database | **PostgreSQL**: Supabase in production, `postgres:17` in Docker locally | The learner's choice (Supabase). Local Postgres keeps experiments away from live demo data | https://supabase.com/docs/guides/database/connecting-to-postgres |
| Sign-in | **Own sign-in in NestJS**: `argon2` 0.45 + `@nestjs/jwt` 12, without Passport | The learner's choice. No credential-change endpoints exist, so demo locks are automatic | https://docs.nestjs.com/security/authentication, https://github.com/ranisalt/node-argon2 |
| Rate limiting | **@nestjs/throttler 6.7** on the auth routes only | Protection against password guessing and mass sign-ups | https://docs.nestjs.com/security/rate-limiting |
| Timers | **@nestjs/schedule 12** (in-process, `cron` 4.4) | Runs on the always-on machine. No external scheduler | https://docs.nestjs.com/techniques/task-scheduling |
| Push | **web-push 3.6.7** (VAPID; CommonJS, imported as `import webpush from 'web-push'`) + a hand-written service worker | Standard Web Push. No Apple Developer account needed | https://github.com/web-push-libs/web-push, https://developer.mozilla.org/en-US/docs/Web/API/Push_API |
| Tests | **Vitest 5** in both projects (frontend logic and the backend, the NestJS 12 default), **Supertest 7** for backend HTTP e2e, **Playwright 1.63** for browser journeys | One test runner across the repo, plus mechanical verification for each `5-build` slice | https://vitest.dev, https://docs.nestjs.com/fundamentals/testing, https://playwright.dev |
| Runtime | **Node.js 24 LTS** ("Krypton", 24.21 at writing) in Docker `node:24-bookworm-slim` | LTS until 2028-04-30. argon2 ships prebuilt Linux binaries, so the image needs no build tools. Local Node 26 is fine for tooling | https://github.com/nodejs/Release |
| Containers | **Docker** (OrbStack locally) | The learner's choice: one-command local stack. The backend image is the one deployed | https://docs.docker.com/compose/ |
| Provisioning CLIs | **flyctl**, **Supabase CLI**, **Vercel CLI** | The agent provisions everything after the learner's one-time browser sign-ins | https://fly.io/docs/flyctl/, https://supabase.com/docs/guides/local-development/cli/getting-started, https://vercel.com/docs/cli |

Versions verified on 2026-10-03 against npm: Vite 8.3, React 19.3, React Router 8.4, TanStack Query 5.104, NestJS 12.1, Prisma 7.10, web-push 3.6.7, argon2 0.45.1, @nestjs/throttler 6.7.1, class-validator 0.15.1, Vitest 5.0, Supertest 7.3, Playwright 1.63. Pin majors in `package.json`.

## Where It Runs and How Someone Tries It

### Locally (development)
- **Needs:** Docker (OrbStack); Node 24+ for tools on the host (Node 26 is installed); `openssl`. To test push on `localhost` (a secure context): desktop Chrome, Edge or Firefox.
- **First run (from `app/`):**
  ```bash
  ./scripts/init-env.sh                        # creates backend/.env + frontend/.env from the .example files and fills
                                               # JWT_SECRET (openssl rand -base64 48) and VAPID keys (web-push) without printing them
  docker compose up --build -d                 # db (postgres:17) + backend (watch mode) + frontend (Vite)
  docker compose exec backend npx prisma migrate dev
  docker compose exec backend npm run seed     # DevPost Demo House, 3 bots, 3 demo accounts (idempotent)
  ```
- **Open:** http://localhost:5173 (web app). The API is at http://localhost:3000. Postgres is at `localhost:5432`, user, password and database all `hushmate` (local only).
- **Tests:**
  ```bash
  docker compose exec backend npm test             # Vitest unit tests
  docker compose exec backend npm run test:e2e     # Vitest + Supertest against the hushmate_test database
  docker compose exec frontend npm test            # Vitest (quiet-time and overlap maths, copy)
  cd frontend && npx playwright install --with-deps chromium && npx playwright test   # against the running compose stack
  ```
- **Stop and reset:** `docker compose down` (keeps data), `docker compose down -v` (wipes the local database).
- **Phones:** push to a real phone needs **HTTPS**, so phone testing uses the deployed URL. Deploy early (see the build order hint).
- **Rule:** a local backend **only ever** uses the compose database. Never put the production `DATABASE_URL` in `backend/.env`, because two running schedulers would both fire.

### Live (the learner chose to host)
**Sign-ins the learner does once, in the browser:** `fly auth login`, `supabase login`, `vercel login`. **Everything else is done by the agent in build slice 1**, with secrets generated on this Mac, kept in git-ignored `backend/.env.production.local`, and piped to the services. **Secrets are never printed in the terminal output or chat.**

**Database → Supabase (free)** (`External Services and Dependencies > Supabase`):
1. `supabase projects list` checks the free-project limit.
2. The agent confirms the **name** (`hushmate`) and **region** with the learner (the region nearest Fly's `sjc`; the existing `hushmate.hackathon` project in us-west-2 was used), then runs `supabase projects create` with a generated database password.
3. The agent creates the dedicated **`prisma` database user** per Supabase's Prisma guide, using `psql` and a generated password.
4. The agent writes the **Session pooler** URL to `.env.production.local`:
   `DATABASE_URL=postgresql://prisma.<project-ref>:<password>@<pooler-host>:5432/postgres?sslmode=no-verify`
   - `sslmode=no-verify` means **encrypted, without certificate checking** (the learner's choice: simplest, and no certificate file to manage).
   - The transaction pooler (6543 / `pgbouncer=true` / `DIRECT_URL`) is Supabase's *serverless* pattern and isn't used.

**Backend → Fly.io (a new app)** (`Infrastructure and config > fly.toml`):
1. `brew install flyctl`.
2. `fly apps create hushmate-api`, then deploy with `fly deploy --ha=false` (Fly's `sea` region is deprecated for new resources, so the app runs in `sjc`).
   - `--ha=false` gives **one** machine instead of Fly's default two.
   - `fly launch` writes `auto_stop_machines = "stop"`, so the agent replaces `fly.toml` with the spec's version.
3. `fly config validate --strict`.
4. `fly secrets import < .env.production.local`. Keys:
   - `DATABASE_URL`, `JWT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
   - `FRONTEND_ORIGINS`, `APP_URL`, `DEMO_ACCOUNT_PASSWORD`
5. `fly deploy`. The `release_command` runs `npx prisma migrate deploy` in a temporary machine before the new version starts.
6. Seed once: `fly ssh console -C "node dist/prisma/seed.js"`.
7. Check: `fly scale show` (exactly 1 machine) and `fly machine status <id>` (restart policy `always`).
8. **A new app means a new machine.** If the old always-on app still runs, the bills add up. If it ever held this `DATABASE_URL`, jobs would double-fire, so retire it if it's unused.

**Frontend → Vercel** (`Infrastructure and config > vercel.json`):
1. `vercel link` with project root `app/frontend`.
2. `vercel env add VITE_API_URL production` (value `https://<app>.fly.dev`).
3. `vercel deploy --prod`. A git integration can replace this once the public GitHub repo exists.
4. Put the production URL into `APP_URL` and `FRONTEND_ORIGINS` (Fly secrets) and into the CSP `connect-src` in `vercel.json`.

**Predictable bill** (the learner wants no surprises):
- Fly: one `shared-cpu-1x` 512 MB machine, always on, about **$3.69 a month** at 2026-10-01 prices. No volumes, no autoscaling, no dedicated IPv4.
- Vercel Hobby: $0.
- Supabase Free: $0 (Vercel and Supabase stop at their limits rather than bill).
- Web Push: free.

**Custom domain:** later. Then update `APP_URL`, `FRONTEND_ORIGINS`, `VITE_API_URL` and the CSP.

### The demo video (required) and the repo
- Record on **two devices**: e.g. an Android phone in Chrome, and an iPhone with Hushmate on the Home Screen. Sign into two demo accounts, nudge from one, and show the notification, the overlay and **Got it**, then the sender's quiet toast and Summary card.
- Also show a bot's Demo nudge arriving, and a bot acknowledging a nudge.
- The README lists:
  - the live URL
  - the three demo logins (`judge1@example.com`, `judge2@example.com`, `judge3@example.com` with the published `DEMO_ACCOUNT_PASSWORD`)
  - the sign-out warning
  - the iPhone steps: add to the Home Screen, open it from there, sign in again, turn on notifications

## Look and Feel
Carries `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`. There's no new design discovery.
- **Tokens:** copy `../planning/design-system/tokens.css` to `frontend/src/styles/tokens.css`. It's the single source of colours, type, spacing, radius and motion, in both modes.
  - The theme is set by `data-theme` on `<html>`: none = follow the device; `"light"` or `"dark"` = manual override from Profile.
  - Components use `var(--hm-…)` only. **No hard-coded colours.**
  - **One override** (design review 2026-10-04): after copying, set `--hm-border-control` to `#6B77A9` (dark) and `#847D91` (light), so control borders reach 3:1 on `--hm-surface-2` as well as on the page.
- **Fonts:** Fredoka 500/600 (headings, and **anything the app says**: nudges, the overlay, empty-state headlines) and Nunito 400/700 (everything else), self-hosted via Fontsource.
- **Flat and tonal:** no gradients, no shadows. Depth comes from `--hm-surface-1/-2`. Pastels are always fills carrying Night text.
- **Colour roles:**
  - peach `--hm-nudge` only on the nudge button and sheet
  - mint `--hm-ack` only on Got it and acknowledged states, including the dot on the acknowledgement toast. Every other toast has a neutral `--hm-text-3` dot (design review 2026-10-04).
  - butter `--hm-streak` only on the Quiet Streak
  - "you" in lavender; housemates `--hm-mate-1..5` by `colorIndex` 0–4
- **Calendar blocks:** filled (`--hm-mate-N` fill, Night text) when the quiet time counts in this house. Outlined (2px `--hm-mate-N-ink`) with the word "away" when the person's active house is elsewhere.
- **Week view** (design review 2026-10-04): too narrow for text, so each person is a thin stripe (filled or outlined, as above) with a name legend under the grid. Tapping a day opens the day view.
- **Motion:** fades with `--hm-ease-out`; sheets rise 24px; the nudge overlay card rises `--hm-rise` (8px); a 4s breathing ring on Resting now, out of sync per avatar; the streak counts up in 700ms. All of it respects `prefers-reduced-motion`.
- **Icons:** `lucide-react`, 2px stroke, 24px.
- **App icons and manifest:**
  - Copy `../planning/logo/kit/web/*` (favicons, `icon-192/512`, maskable icons, `apple-touch-icon.png`, `site.webmanifest`) to `frontend/public/`, and add `"id": "/"` and `"scope": "/"` to the manifest.
  - Add the kit's `head-snippet.html` tags to `index.html`.
  - **Android notification badge:** `public/badge-96.png`, rendered from the kit's `svg/h-symbol-black.svg` as a white glyph on transparency at 96×96. Android uses only its alpha channel.
  - Fredoka is OFL-licensed (`Fredoka-OFL.txt` ships with the kit).
- **Copy voice:** third person, warm, brief, never naming a sender (`design-system.md` §7).
- **Mockups:** `docs/forge/design/mockups/` shows every screen and state in dark and light at 390px (reviewed at the design review 2026-10-04). `docs/forge/design/README.md` maps each frame to its `Frontend: …` heading.
- **Constraint:** none from the stack. CSS Modules can express the whole design system.

## Components

### Frontend
Lives in `app/frontend/src/`. Every screen is mobile-first (a 360–430px wide target), with a 20px gutter and touch targets of at least 48px.

#### Frontend: App shell and routing
- `App.tsx` routes:
  - public: `/` (landing), `/signup`, `/signin`, `/join/:inviteToken`
  - signed in: `/onboarding/*` and the tabs `/schedule`, `/summary`, `/houses`, `/profile`
- `RequireAuth`: no token → `/signin` with **return-to** (the requested path).
- **After sign-up or sign-in:**
  - a stored return-to path (e.g. `/join/:token`) wins
  - otherwise, no memberships → `/onboarding`
  - otherwise, an approved membership with `setupDone: false` → `/onboarding/setup/:houseId`
  - otherwise → `/schedule`
- `GET /me` is fetched on **every app load** (and on refocus). It supplies `isDemo`, `demo.botNames`, `activeHouseId` and `nudgeCooldownUntil`.
- On every load and refocus, on a service-worker message, and every 15 s while the page is visible (`refetchIntervalInBackground: false`), it checks `GET /nudges/pending`. If anything is waiting, it shows `NudgeOverlay` above everything. After that, an approved membership with `setupDone: false` (from `GET /houses`) routes to its setup.
- A `message` listener on `navigator.serviceWorker` invalidates the pending-nudges query when a push arrives.
- **On every load with notification permission granted,** it re-sends the current push subscription (`POST /push/subscriptions`). That moves the device to the signed-in account and repairs rotated subscriptions.
- `TabBar`: Schedule · Summary · Houses · Profile.
- PRD ref: `prd.md > Screens and Layout`, `prd.md > Accounts and Sign-In`.

#### Frontend: API client and session
- `api/client.ts`: a fetch wrapper that sends `Authorization: Bearer <token>` and parses errors as `{statusCode, message: string | string[], error?}`.
- **401 from any non-`/auth` route** (expired or invalid token) → sign out locally (see `Frontend: Profile`, steps 2–4) → `/signin` with return-to.
- A 401 from `/auth/signin` means wrong credentials and shows a form error.
- `QueryClient`: `retry` skips 400/401/403/404/409/429. Focus refetching stays on.
- `api/types.ts` mirrors the shapes in `External Services and Dependencies > The backend API contract`. `api/hooks/*.ts` has one hook per endpoint group.
- `auth/AuthContext.tsx` holds the token and the `GET /me` result. `auth/RequireAuth.tsx` guards routes.
- PRD ref: `prd.md > Accounts and Sign-In`.

#### Frontend: Auth screens
- **Landing:** sign up / sign in.
- **Sign up:** name (1–30 characters), email, password (8–128).
- **Sign in:** email and password, with the same error for any failure.
- Field errors come from the API's validation messages.
- PRD ref: `prd.md > Accounts and Sign-In`.

#### Frontend: Join by link
- `/join/:inviteToken` is public. It shows the house name from `GET /invites/:token`.
- **Signed out:** **Sign up to join** / **Sign in to join** store the return-to.
- **Signed in:** **Request to join** → `POST /invites/:token/join` → the **Request sent** screen (see `Frontend: Onboarding`).
- **Demo house:** the backend refuses ("This is a demo house"), and the page shows that message.
- PRD ref: `prd.md > Houses and the Active House`, `prd.md > Onboarding`.

#### Frontend: Onboarding
Two parts (learner, design review 2026-10-04):
- **Start** (`/onboarding`, no memberships):
  - **Create a house** (name 2–30 characters, no spaces, no `#`) → **House created** (the `Name#123456` ID and **Copy invite link**) → Setup.
  - **Join** (by ID or link) → **Request sent**. Nothing else: no quiet times and no notification setup yet. **Go to Schedule** shows the waiting-for-approval empty state.
- **Setup** (`/onboarding/setup/:houseId`), for any approved membership with `setupDone: false`. That's right after creating a house, or the first open after a join is approved (later houses too):
  1. Joiners see **"You're in {House}"** first. Creators skip it.
  2. Optional first quiet times (reuses `QuietTimeEditor`).
  3. Notification setup (`Frontend: Push setup`), skipped when it's already **On**.
  4. `POST /memberships/:id/setup-done`, then Schedule. A setup route for a membership that's already done redirects to `/schedule`.

PRD ref: `prd.md > Onboarding`.

#### Frontend: Push setup
`push/register.ts` and `push/ios.ts`, plus `components/NotificationSetup.tsx`. The component is used in setup **and** in Profile.

- **Registration:** `navigator.serviceWorker.register('/sw.js')` after `window` load.
- **On mount:** prefetch the VAPID key (`GET /push/vapid-public-key`) and `navigator.serviceWorker.ready`. iPhone loses the tap if the app fetches anything after the tap and before subscribing.
- **States, checked in this order:**
  1. **Unsupported** (`!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)`): one line explaining, and carry on.
  2. **iPhone/iPad not standalone** (neither `matchMedia('(display-mode: standalone)')` nor `navigator.standalone`; iPadOS is a `Macintosh` UA with `maxTouchPoints > 1`): the Add-to-Home-Screen steps. "Share → Add to Home Screen (keep 'Open as Web App' on), then open Hushmate from your Home Screen and **sign in again**."
  3. **`denied`:** no nagging. One line: "Turn notifications on in Settings → Notifications → Hushmate."
  4. **`default`:** the **Turn on notifications** button. On tap, `Notification.requestPermission()` then `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <Uint8Array from base64url> })`, then `POST /push/subscriptions` with `subscription.toJSON()`.
  5. **`granted`:** shows "On", and re-syncs silently.
- PRD ref: `prd.md > Onboarding`, `prd.md > Notifications`, `prd.md > Profile and Theme`.

#### Frontend: Service worker
`public/sw.js`, hand-written, with **no offline caching**. Vite copies it to `/sw.js` (root scope).

- **`install`:** `skipWaiting()`. **`activate`:** `clients.claim()`.
- **`push`:** all work inside `event.waitUntil(...)`. **It always calls `showNotification`**, because Safari revokes permission after a push with no notification.
  - Read the declarative envelope `n = payload.notification`.
  - If parsing fails, fall back to `{title: "Hushmate", body: "Someone nearby could use some quiet."}`.
  - `showNotification(n.title, { body: n.body, tag: n.tag, renotify: true, icon: '/icon-192.png', badge: '/badge-96.png', lang: 'en', data: { type: n.data.type, url: n.navigate } })`.
  - Then `postMessage({type})` to every window from `clients.matchAll({type: 'window', includeUncontrolled: true})`.
- **`notificationclick`:** `close()`. Focus a same-origin window and `postMessage`, or else `clients.openWindow(data.url)`.
- **Join-approved** uses the same path. The body comes from the backend, and a tap opens that house's setup (`/onboarding/setup/:houseId`).
- **iPhone:** `tag`, `renotify`, `icon` and `badge` are ignored, so nudges stack. That's fine.
- PRD ref: `prd.md > Notifications`, `prd.md > Acknowledging a Nudge`.

#### Frontend: Calendar
- **`DayView`:** a 24-hour vertical grid; one lane per member ("you" first, in lavender); blocks positioned by minute; a now line; a floating **Nudge** button.
- **Header:** the house name, a **+** button (Add quiet time), previous and next day arrows with the date, and the Day/Week toggle. Tapping your own block opens the editor.
- **`WeekView`:** 7 columns, **Monday first**. Each person is a thin stripe in their pastel, side by side inside a day, with no text. A name legend sits under the grid, and tapping a day opens it in the day view (design review 2026-10-04).
- **Day/week toggle;** it keeps the house and date.
- **Time maths** in `lib/quietTime.ts` (see `Frontend: Shared lib`). Times are wall-clock, read in the phone's local time.
- PRD ref: `prd.md > Schedule (Calendar)`, `prd.md > Quiet Times`.

#### Frontend: Quiet-time editor
- A bottom sheet with:
  - a start time picker and an end time picker (15-minute steps; the end is labelled "(next day)" when it's earlier than the start)
  - Monday–Sunday day chips
  - save, and delete when editing
- **Editing** an existing quiet time asks **"Just this day" / "All days in this set"**. This applies to save and delete.
- **Before saving,** it runs `findOverlaps()` locally. A clash blocks saving with "This overlaps your quiet time on Mon 11:00 PM → 7:00 AM (next day)." It shows the same message from a backend `409`.
- Shown only for the active house, plus the setup step.
- PRD ref: `prd.md > Quiet Times`.

#### Frontend: Nudge sheet
- "Who's being loud?" lists all members except you.
  - Away members are disabled and marked "away".
  - Members not in a quiet time show "Not resting" (design review 2026-10-04).
  - Resting members show the breathing ring, and tapping one opens a **confirm dialog**.
  - A house with only you: "There's nobody to nudge yet."
- After sending: the toast "Nudge sent quietly", and the **CooldownPill** ("Nudge again in 4:32") counts down to `cooldownUntil`.
- **After a reload or on another device,** the pill starts from `GET /me.nudgeCooldownUntil`.
- PRD ref: `prd.md > Nudging (the kernel)`.

#### Frontend: Nudge overlay
- A scrim plus a card: the app icon, the `message` in the Voice style, and the `subtitle` when present (demo nudges), plus a full-width mint **Got it**.
- One overlay covers all pending nudges. **Got it** → `POST /nudges/acknowledge` → it fades out, and optionally closes leftover `nudge` notifications (`registration.getNotifications({tag: 'nudge'})`).
- PRD ref: `prd.md > Acknowledging a Nudge`.

#### Frontend: Summary
- **The Quiet Streak tile** counts up. When `isDemo`, it adds the demo note (`lib/copy.ts`).
- **Resting now** is worked out locally from the board, housemates only (not you).
- **Heads-up cards** (time chip, text, author), and a **Post heads-up** sheet: a 200-character counter, and a date-and-time picker that only allows future times.
- **"Your nudge was acknowledged" cards**, naming who tapped Got it from `recipientName` ("Jordan tapped Got it · 4 min ago", learner, design review 2026-10-04). A toast shows if one is under an hour old and its id isn't in this device's `toastedAcks` (local storage).
- **Refetches** every 30 seconds while visible.
- PRD ref: `prd.md > Summary Board`.

#### Frontend: Houses
- **House cards:** Active (top), Inactive (**Make active**), Pending, Declined (dismiss).
- **Create house** (name 2–30 characters, no spaces, no `#`), **Join by ID** (`Name#123456`), and **Copy invite link**.
- Owners see a "Requests" list with **Approve** and **Decline**.
- Demo accounts see the demo house only, with every house-changing control hidden.
- PRD ref: `prd.md > Houses and the Active House`.

#### Frontend: Profile
- Shows name and email.
- **Notifications row** (learner decision): `NotificationSetup` in compact form, showing On / Off / Not available plus the guidance for that state.
- **Theme:** follow device / light / dark, stored **per device in local storage**.
- **Sign out:**
  1. `DELETE /push/subscriptions {endpoint}`. If that fails (offline, or a 401 after the token expired), call `subscription.unsubscribe()` in the browser, so the push service answers 410 and the backend deletes the row.
  2. Clear the token.
  3. Clear the cached data (`queryClient.clear()`).
  4. Clear the local keys: welcome card, toasted acks, return-to.
- PRD ref: `prd.md > Profile and Theme`, `prd.md > Demo House`.

#### Frontend: Demo welcome card
- Shown after each demo sign-in on this device.
- Copy from `lib/copy.ts`, with the bot names from `GET /me.demo.botNames`: "Welcome to DevPost Demo House. {Maya, Jordan and Priya} are simulated housemates. They'll nudge you every 30 minutes to 2 hours so you can feel how Hushmate works. When you're done, sign out, or the nudges will keep coming."
- PRD ref: `prd.md > Demo House`.

#### Frontend: Shared UI components
`components/`, every one built from tokens:
- `TabBar`
- `Button` (primary, nudge, got it, secondary, ghost)
- `Sheet` (Radix Dialog as a bottom sheet)
- `ConfirmDialog`
- `Toast` (Radix Toast, never stacking; a neutral dot, mint only for acknowledgements)
- `Avatar` (an initial on a pastel, with an optional breathing ring)
- `EmptyState` (Voice headline, caption, one button)
- `HouseCard`
- `CooldownPill`
- `NotificationSetup`
- `NudgeOverlay`
- `DemoWelcomeCard`

PRD ref: `prd.md > Look and Feel`.

#### Frontend: Shared lib
- **`lib/quietTime.ts`** (unit tested):
  - `segmentsForDay(rows, date)`: an overnight row (`endMinute <= startMinute`) gives start → 24:00 on its day and 00:00 → end on the next day.
  - `isRestingNow(rows, now)`.
  - `findOverlaps(candidate, rows)`: the circular-week check, identical to the backend's.
  - `dayOfWeek` follows JavaScript's `getDay()`: **0 = Sunday … 6 = Saturday**.
- **`lib/time.ts`:** formatting ("11:00 PM", "Mon"), 15-minute steps, and the Monday-first week.
- **`lib/colors.ts`:** `colorIndex` 0–4 → `--hm-mate-1..5`; "you" → `--hm-mate-you`.
- **`lib/copy.ts`:** the welcome card template, the demo streak note, and the iPhone steps. Nudge messages and the demo subtitle are **not** here; the backend sends them.
- PRD ref: `prd.md > Quiet Times`, `prd.md > Look and Feel`, `prd.md > Demo House`.

### Backend
Lives in `app/backend/src/`, as NestJS modules.

#### Backend: App bootstrap
- **`main.ts`:**
  - `NestFactory.create(AppModule)`, `app.enableShutdownHooks()`
  - CORS: `origin` = the exact list from `FRONTEND_ORIGINS` (comma-separated); methods GET, POST, PATCH, DELETE; headers `Authorization` and `Content-Type`; `exposedHeaders: ['Retry-After']`; `credentials: false`
  - listen on `PORT` (3000)
  - then trigger the scheduler's boot checks (`Backend: Scheduler`)
- **`app.module.ts`** registers:
  - `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` as `APP_PIPE`, so tests get it too
  - the global `AuthGuard` as `APP_GUARD`
  - `ScheduleModule.forRoot({ cronJobs: process.env.SCHEDULER_ENABLED !== 'false' })`, **imported once, here only**
  - `ThrottlerModule`, `JwtModule` (global) and every feature module
- **Errors:**
  - Nest's default shape `{statusCode, message, error}` (`message` may be an array for validation errors)
  - a filter maps Prisma `P2002` (unique violation) → 409
- **Config:** env is read once in `config.ts`. Boot **fails** if `JWT_SECRET` (≥ 32 bytes), `DATABASE_URL`, any `VAPID_*` or `APP_URL` is missing.
- **Never** log request bodies, the `Authorization` header, or full push endpoints.

#### Backend: Database access
- **`prisma/prisma.service.ts`:** extends `PrismaClient` with `adapter: new PrismaPg({ connectionString: DATABASE_URL, max: 5, idleTimeoutMillis: 60_000, connectionTimeoutMillis: 10_000, keepAlive: true, statement_timeout: 15_000, query_timeout: 15_000 })`.
  - `$disconnect()` in `onApplicationShutdown`, so it runs after the timers stop.
  - SSL comes only from the URL: `?sslmode=no-verify` in production, none locally.
- **`prisma.config.ts`:** schema `prisma/schema.prisma`, migrations `prisma/migrations`, datasource URL from `DATABASE_URL`, and the seed command.
- PRD ref: `prd.md > States and Boundaries` (Persistence).

#### Backend: Auth module
- **`AuthGuard`** (global; hand-written with `@nestjs/jwt`, no Passport):
  - reads `Authorization: Bearer`, then `verifyAsync` with `algorithms: ['HS256']`
  - loads the user by `sub` and rejects a missing user or `isBot`
  - sets `request.user = {id, isDemo, activeHouseId}`
  - `@Public()` skips it; `@CurrentUser()` reads `request.user`
  - every token error → 401
- **Public routes:** `/auth/signup`, `/auth/signin`, `/health`, `/push/vapid-public-key`, `GET /invites/:token`.
- **`POST /auth/signup {name, email, password}`** → `201 {token, user}`:
  - name trimmed, 1–30 characters
  - email trimmed and lower-cased, `@IsEmail`, max 254, unique (an existing one → 409)
  - password 8–128 characters, never trimmed
  - hash: **argon2id** `{memoryCost: 19456, timeCost: 2, parallelism: 1}`
- **`POST /auth/signin {email, password}`** → `200 {token, user}`:
  - any failure (unknown email, wrong password, a bot, which has no password) → **the same 401 body**
  - unknown emails are checked against a dummy hash computed at boot, so the timing doesn't reveal which emails exist
- **Throttling:** `ThrottlerGuard` on `AuthController` only. Sign-up and sign-in each allow **5 a minute per client IP**, where the tracker is the `Fly-Client-IP` header, falling back to `req.ip`. Over the limit → `429` with `Retry-After`. There's **no per-account lockout**, because the demo passwords are public.
- **Token:** a JWT `{sub}` only, HS256, `JWT_SECRET` (48 random bytes), `expiresIn: '30d'`, no refresh. Rotating `JWT_SECRET` signs everyone out (the emergency switch).
- **There are no endpoints** to change the name, email or password or to delete an account. That's deferred, and it's how demo accounts stay locked.
- PRD ref: `prd.md > Accounts and Sign-In`.

#### Backend: Me
- `GET /me` → the `User` shape (see the API contract):
  - **`nudgeCooldownUntil`:** the sender's latest nudge time + 5 minutes, if that's still in the future, else `null`.
  - **`demo`** (demo accounts only): `{houseName, botNames}`. The bot names come from the database (`users.isBot` members of the demo house, in seed order). That's the single source of truth (learner decision).
- **Arming bot nudges** (demo accounts): a conditional `updateMany({ where: { id, isDemo: true, demoNextNudgeAt: null }, data: { demoNextNudgeAt: now + random(1–10 min) } })`, so concurrent opens can't overwrite each other.
- PRD ref: `prd.md > Demo House`, `prd.md > Nudging (the kernel)`.

#### Backend: Houses module
**Endpoints:**
- **`POST /houses {name}`:**
  - name trimmed, **2–30 characters, no spaces, no `#`** (learner decision; no spaces: design review 2026-10-04). The seeded demo house keeps its spaces, since it's never created through the API.
  - generate a random 6-digit `code` until `(nameKey, code)` is unique
  - create an owner membership (approved, `colorIndex` 0, `setupDoneAt` empty so setup runs next), and set it active if the user has none
- **`GET /houses`:** my memberships with status, `name`, `code`, `isActive`, `isOwner`, `pendingCount` and `setupDone` (`setupDoneAt` is set).
- **`POST /memberships/:id/setup-done`** (your own approved membership): sets `setupDoneAt` if empty → 204. Idempotent.
- **`GET /houses/lookup?id=<Name%23123456>`:** split on the **last** `#` and match case-insensitively on `nameKey` + `code` → `{id, name, code}`, or 404.
- **`GET /invites/:token`** (public): `{name, code}`, or 404.
- **`POST /houses/:id/join`** and **`POST /invites/:token/join`:** create a **pending** membership.
  - Already a member or pending → 409.
  - **The demo house → 403 "This is a demo house"** (learner decision).
- **`GET /houses/:id/requests`** (owner): the pending requests `[{membershipId, name, createdAt}]`.
- **`POST /memberships/:id/approve`** (owner):
  - sets it approved with `colorIndex = (approved members − 1) % 5`
  - sets it active if the requester has none
  - sends the **join-approved push**
- **`POST /memberships/:id/decline`** (owner): sets it declined.
- **`DELETE /memberships/:id`:** the requester dismisses a declined card.
- **`POST /houses/:id/activate`:** must be an approved member. Sets `users.activeHouseId`.
- **`GET /houses/:id/invite-link`** (any approved member): `{url: APP_URL + '/join/' + inviteToken}`.
- **`GET /houses/:id/board`** (approved members): members `{id, name, colorIndex, isAway, isYou}` plus all their quiet times in this house. **No emails, no bot flags.**

**Guards:**
- `DemoGuard` (`@UseGuards`) blocks create, both join routes, activate and dismiss → **403 for `isDemo` users**.
- Non-members get 403 on house routes, and non-owners get 403 on requests, approve and decline.

PRD ref: `prd.md > Houses and the Active House`.

#### Backend: Quiet times module
- **`POST /houses/:id/quiet-times {days[], startMinute, endMinute}`:** creates one row per day, sharing a new `setId`.
  - `days`: unique values 0–6 (0 = Sunday). Minutes: multiples of 15, 0–1425, `start != end`.
  - Allowed if the house is your **active** house, or **that membership's setup isn't done** (`setupDoneAt` empty: the setup step).
- **`PATCH /quiet-times/:id {startMinute, endMinute, scope: "day" | "set"}`:** `day` updates the row and gives it a new `setId` (splitting it out); `set` updates every row with that `setId`.
- **`DELETE /quiet-times/:id?scope=day|set`.**
- **Edits and deletes** are allowed only in your active house.
- **Overlap check** (learner decision) on every create and edit:
  - In `common/quietTimeOverlap.ts`, each row becomes a minute range on a circular week: `day*1440 + start` to `day*1440 + end` (+1440 if overnight), wrapping at 10080.
  - It's compared against your other rows in that house, excluding the rows being edited.
  - A clash → `409 {statusCode, message: "overlap", conflicts: [{dayOfWeek, startMinute, endMinute}]}`.
- PRD ref: `prd.md > Quiet Times`.

#### Backend: Nudges module (the kernel)
- **`NudgesService.createAndSend({houseId, senderId, recipientId, isDemo, skipCooldown})`:**
  1. **Cooldown** (unless `skipCooldown`): if the sender's latest nudge is less than 5 minutes old → `429 {cooldownUntil}`.
  2. Pick `messageIndex` at random (0–4) and insert the nudge.
  3. **After the insert commits,** call `PushService.sendToUser(recipientId, nudgePayload)` **without awaiting** it. Errors are caught and logged.
  4. Return `{cooldownUntil: now + 5 min}`.
- **`POST /nudges {recipientId}`:** sender and recipient have the **same `activeHouseId`**, are both approved there, and are different people → `createAndSend` with cooldown. Otherwise 403.
- **`GET /nudges/pending`** → `[{id, message, subtitle, isDemo, createdAt}]` for me, unacknowledged. `subtitle` is the demo subtitle, or `null`. **The sender is never included.**
- **`POST /nudges/acknowledge`:** sets `acknowledgedAt` on all my pending nudges → `{acknowledged: n}`.
- **`messages.ts`** is the single source for the five PRD messages and the demo subtitle: "This is a demo nudge from a simulated housemate in DevPost Demo House."
- **Privacy rule:** no endpoint lists nudges to anyone except their sender (acknowledgements) and their recipient (pending). No sender id or name appears in any payload, log line or push `topic`.
- PRD ref: `prd.md > Nudging (the kernel)`, `prd.md > Acknowledging a Nudge`.

#### Backend: Heads-ups and Summary module
- **`POST /houses/:id/heads-ups {text, at}`:** text trimmed, 1–200 characters; `at` in the future. Your active house only.
- **`GET /houses/:id/summary`** → `{streakDays, isDemo, headsUps: [{id, text, at, authorName}], myAcks: [{nudgeId, recipientName, acknowledgedAt}]}`.
  - Heads-ups are filtered to `at > now()`; nothing is deleted.
  - `myAcks` covers the last 24 hours, sender only.
  - **Streak:** whole days (America/Vancouver) since the house's latest nudge, or since the house was created if there's never been one. **The demo house always returns 10.**
- PRD ref: `prd.md > Summary Board`.

#### Backend: Push module
- **`GET /push/vapid-public-key`** (public) → `{key}`.
- **`POST /push/subscriptions {endpoint, keys: {p256dh, auth}}`:**
  - The endpoint must be `https:` on a **known push host**: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.push.apple.com` or `*.notify.windows.com`. Anything else → 400.
  - **Upsert by `endpoint`, reassigning `userId` to the caller**, so a shared phone follows whoever signed in last.
- **`DELETE /push/subscriptions {endpoint}`:** removes that row (only the caller's own).
- **`PushService`:**
  - `webpush.setVapidDetails(VAPID_SUBJECT, …)` in `onModuleInit`. The subject is a real `mailto:` address, never localhost.
  - `sendToUser(userId, payload)` sends to every subscription with `Promise.allSettled`, each handled on its own.
  - **Payload: the declarative envelope** (learner decision, A2), the same bytes for every browser:
    `{web_push: 8030, mutable: true, notification: {title: "Hushmate", body, navigate, tag, lang: "en", data: {type}}}`
    - nudge: `body` = the message, plus `"\n"` + the subtitle for demo; `navigate` = `APP_URL + "/schedule"`; `tag` `"nudge"`
    - join-approved: `body` = "You're in! {House} approved your request."; `navigate` = `APP_URL + "/onboarding/setup/" + houseId`; `tag` `"join-approved"`
  - **Send options:**
    - nudge: `{TTL: 1800, urgency: 'high', timeout: 10000}` (no `topic`: Apple rejects it with 400 `BadWebPushTopic`; found live in slice 4)
    - join-approved: `{TTL: 86400, urgency: 'normal', timeout: 10000}`
    - option keys are exact (`TTL`, not `ttl`; unknown keys throw)
  - **Results:**
    - 201 → done
    - **404/410** → delete the subscription
    - 413 → log a bug
    - 429 or 5xx → log, no retry (the overlay is the fallback)
    - 400/401/403 → log loudly as a VAPID config error and **keep** the row
  - Log only `new URL(endpoint).host`.
- PRD ref: `prd.md > Notifications`.

#### Backend: Demo module
- **`demo/demo-data.ts`:** pure data plus `upsertDemoWorld(prisma)` and `resetDemoContent(prisma)`. They're shared by `prisma/seed.ts` (a standalone script that **never boots the Nest app**, so no timers) and `DemoService`.
- **The demo world** (upserted **by email**, so IDs stay stable and judges' tokens survive the reset):
  - **DevPost Demo House**, code `202610` (`DevPost Demo House#202610`), `isDemo = true`, **owned by the bot Maya** (learner decision: nobody can approve anyone in).
  - **3 bots** (`isBot`, `passwordHash = null`): `maya.bot@example.com`, `jordan.bot@example.com`, `priya.bot@example.com`.
  - **3 demo accounts** (`isDemo`): `judge1@example.com`, `judge2@example.com`, `judge3@example.com` (names "Judge 1", "Judge 2", "Judge 3"), with the password from `DEMO_ACCOUNT_PASSWORD`.
  - All six are approved members, with `colorIndex` 0–4 then 0 (the sixth repeats sky), and `setupDoneAt` set, so demo accounts never see setup. The demo house is everyone's active house.
- **Bots** (accepted). `dayOfWeek`: 0 = Sunday.

  | Bot | Quiet times |
  |---|---|
  | **Maya** | 11:00 PM → 7:00 AM, Sunday–Thursday |
  | **Jordan** (opens a café) | 8:30 PM → 4:30 AM daily, plus 1:00–3:00 PM on Saturday |
  | **Priya** (night shifts) | 6:00 → 9:00 AM on weekdays (**the morning one**), plus 10:30 PM → 6:00 AM Friday and Saturday |

  Heads-ups refreshed at each reset (Vancouver time): Priya "Coming home late, might make late dinner" (today at 11:30 PM); Maya "Friends over for a movie" (tomorrow at 8:00 PM).
- **Bot nudges** (minute tick), **claim, then send:**
  1. For each demo user, a conditional `updateMany({ where: { id, demoNextNudgeAt: { lte: now } }, data: { demoNextNudgeAt: now + random(30–120 min) } })`.
  2. If it updated a row (the claim succeeded): pick a random bot, then `createAndSend({ isDemo: true, skipCooldown: true })`.

  This is at most once: a crash between the steps drops a single nudge.
- **Bot acknowledgements** (minute tick): `updateMany({ where: { acknowledgedAt: null, createdAt: { lte: now − 60 s }, recipient: { isBot: true } }, data: { acknowledgedAt: now } })`.
- **The nightly reset** (`resetDemoContent`), inside one `$transaction` with `timeout: 20_000`:
  1. **Guard:** `INSERT INTO system_state (key, value) VALUES ('lastDemoResetAt', now()) ON CONFLICT (key) DO UPDATE SET value = now() WHERE system_state.value < <latest 03:00 Vancouver> RETURNING key`. No row back → it's already done, so stop.
  2. Delete the demo house's nudges and heads-ups, and the demo accounts' quiet times.
  3. Upsert the demo world, restore the bots' quiet times, and insert fresh bot heads-ups.
  4. Set `demoNextNudgeAt = null` for demo users. They're re-armed by the next `GET /me` (learner decision: bots pause until the app is next opened).
- PRD ref: `prd.md > Demo House`.

#### Backend: Scheduler
`scheduler/scheduler.service.ts` has three named `@Cron`s. Each has `waitForCompletion: true`, and every handler runs through **one in-process `runExclusive()`** promise chain.

| Job | Schedule | Work |
|---|---|---|
| `minute` | `* * * * *` | 1. **Reset overdue?** If `lastDemoResetAt` is before the latest 03:00 Vancouver → reset (catch-up). 2. Bot nudges. 3. Bot acks. |
| `demoReset` | `0 3 * * *`, `timeZone: 'America/Vancouver'` | The nightly reset (the primary trigger) |
| `heartbeat` | `0 12 * * *`, `timeZone: 'America/Vancouver'` | Upsert `system_state.heartbeatAt = now()`. A belt-and-braces activity signal for Supabase; normal traffic already counts |

- **Boot**, after `app.listen()`: run the overdue-reset check and the heartbeat once.
- **Shutdown:** `onModuleDestroy` sets `shuttingDown`, so new ticks return at once, then awaits the in-flight `runExclusive` promise.
- **Every await has a timeout:** the database (pool and statement timeouts) and push (10 s). A hung call can't freeze the minute job.
- **Safety:** every job is idempotent through database claims and guards, so an accidental second instance can't double-send. `SCHEDULER_ENABLED=false` is the kill switch for any ad-hoc process pointed at production.
- Requires the single always-on Fly machine.

#### Backend: Common utilities
`common/`:
- `vancouverTime.ts`: the latest 03:00 America/Vancouver, and whole-day differences for the streak
- `quietTimeOverlap.ts`: the circular-week check; its tests mirror the frontend's
- `random.ts`: a 6-digit code, an invite token (32 bytes, base64url), and a random interval in minutes
- `config.ts`: typed env with boot-time validation

#### Backend: Health
- `GET /health` (public): `SELECT 1` → `200 {ok: true, db: true}`, otherwise **`503 {ok: false, db: false}`**. Fly's check then marks the machine unhealthy.

### Testing
- **Backend unit** (Vitest):
  - `quietTimeOverlap`, including overnight and Sunday→Monday wrapping
  - `vancouverTime`, including the DST weeks
  - messages and payload building, including the subtitle and the declarative envelope
- **Backend e2e** (Vitest + Supertest):
  - against the `hushmate_test` database on the compose Postgres (`TEST_DATABASE_URL`), with `prisma migrate reset --force` once and tables truncated between files
  - files run sequentially; the app is built through the same `configureApp()` that `main.ts` uses
  - **auth:** sign-up `{token, user}` without `passwordHash`; a duplicate email in different case → 409; a 7-character password → 400; wrong password and unknown email give identical 401s; a bot can't sign in; the 6th sign-in within 60 s → 429; no, garbage, wrong-secret and expired tokens → 401
  - **demo locks:** a demo user gets 403 on create, both joins, activate and dismiss, but can still `GET /me` and add quiet times; joining the demo house → 403
  - **kernel:** cooldown 429 with `cooldownUntil`; `GET /me.nudgeCooldownUntil`; pending never contains the sender; only the sender sees acks; a nudge across different active houses → 403; a bot ack after 60 s; bot nudges skip the cooldown
  - **quiet times:** overlap → 409 with `conflicts`; scope day vs set
  - **push:** an unknown host → 400; upsert reassigns the user; a 410 deletes the row (mocked `web-push`)
  - **reset:** IDs are unchanged after the reset; the guard makes a second run a no-op
- **Frontend unit** (Vitest): `quietTime.ts` (segments, resting now, overlaps), `time.ts`, `copy.ts`.
- **Playwright** (against the compose stack, two browser contexts):
  - onboarding: sign up → create house → setup (quiet time, notifications) → Schedule
  - joining: request → Request sent (no setup); owner approves → the next open shows setup for that house
  - **the nudge round trip:** A nudges B → B's overlay → Got it → A's Summary card. Push itself is stubbed; the overlay comes from pending on focus.
  - demo locks: the controls are hidden
- **Push on real devices:** by hand, following the 13-step checklist in `docs/forge/research/web-push.md` §7, after build slice 1 is deployed.

### Infrastructure and config
- **`docker-compose.yml`** (in `app/`):
  - `db`: `postgres:17`, with env `POSTGRES_USER=hushmate`, `POSTGRES_PASSWORD=hushmate`, `POSTGRES_DB=hushmate`, an init script creating `hushmate_test`, a named volume, a healthcheck, and port 5432.
  - `backend`: builds the `dev` target of `backend/Dockerfile`, runs `npm run start:dev`, and uses `env_file: backend/.env`. Port 3000. It depends on `db` being healthy. The source is bind-mounted, with `node_modules` in a container volume.
  - `frontend`: builds `frontend/Dockerfile`, runs `npm run dev -- --host 0.0.0.0`, and uses `env_file: frontend/.env`. Port 5173, bind-mounted.
- **`backend/Dockerfile`**, multi-stage on `node:24-bookworm-slim`:
  - `dev`: deps + source, for compose
  - `build`: `npm ci`, `prisma generate`, `nest build` (which also compiles `prisma/seed.ts` → `dist/prisma/seed.js`)
  - `runtime`: production deps, including `prisma@7`, plus `dist/` and `prisma/`, with `CMD ["node","dist/src/main.js"]` (tsc `rootDir` is `backend/` so the seed compiles to `dist/prisma/seed.js`), plus `prisma.config.ts`, in **exec form** so it receives the stop signal
- **`frontend/Dockerfile`:** for development only (Vite dev server). Vercel builds from source.
- **`backend/fly.toml`:**
  ```toml
  app = "<app>"
  primary_region = "sjc"
  kill_signal = "SIGTERM"
  kill_timeout = 30
  swap_size_mb = 512

  [deploy]
    strategy = "rolling"
    release_command = "npx prisma migrate deploy"

  [http_service]
    internal_port = 3000
    force_https = true
    auto_stop_machines = "off"
    auto_start_machines = true
    processes = ["app"]

  [[http_service.checks]]
    grace_period = "30s"
    interval = "15s"
    timeout = "5s"
    method = "GET"
    path = "/health"

  [[restart]]
    policy = "always"

  [[vm]]
    size = "shared-cpu-1x"
    memory = "512mb"
  ```
  **Never** use the `canary` or `bluegreen` strategies: they boot a second app, so every job runs twice.
- **`frontend/vercel.json`:**
  - `rewrites`: everything → `/index.html`. Real files such as `/sw.js` are served first.
  - `headers` on `/(.*)`:
    - `Content-Security-Policy`: `default-src 'self'; script-src 'self'; connect-src 'self' https://<app>.fly.dev; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
  - `headers` on `/sw.js`: `Cache-Control: no-cache`.
- **`backend/.env.example`:**
  ```
  DATABASE_URL=postgresql://hushmate:hushmate@db:5432/hushmate
  TEST_DATABASE_URL=postgresql://hushmate:hushmate@db:5432/hushmate_test
  JWT_SECRET=
  VAPID_PUBLIC_KEY=
  VAPID_PRIVATE_KEY=
  VAPID_SUBJECT=mailto:you@example.com
  FRONTEND_ORIGINS=http://localhost:5173
  APP_URL=http://localhost:5173
  DEMO_ACCOUNT_PASSWORD=hushmate-demo-local
  SCHEDULER_ENABLED=true
  PORT=3000
  ```
- **`frontend/.env.example`:** `VITE_API_URL=http://localhost:3000`.
- **`scripts/init-env.sh`:** copies the `.example` files if the targets are missing, and fills `JWT_SECRET` and the VAPID keys without echoing them. It's idempotent.
- **`.gitignore`:** add `node_modules/`, `dist/`, `.DS_Store`, `playwright-report/` and `test-results/`. `.env*` (with `!.env.example`) is already covered.
- **`README.md`:** what Hushmate is, the live URL, the demo logins plus the sign-out warning, the iPhone steps, the local setup (the commands above) and the license.

## Data Model
Prisma schema in `backend/prisma/schema.prisma`, Postgres. Times are `timestamptz` unless noted. IDs are `uuid`. `dayOfWeek` uses **0 = Sunday … 6 = Saturday**.

| Table | Fields | Constraints and indexes |
|---|---|---|
| **users** | `id`, `name` (1–30), `email`, `passwordHash` **nullable** (bots), `isDemo` bool, `isBot` bool, `activeHouseId` → houses (nullable), `demoNextNudgeAt` (nullable), `createdAt` | `email` unique (stored trimmed and lower-case) |
| **houses** | `id`, `name` (2–30, no spaces, no `#`; the seeded demo house is the exception), `nameKey` (lower-case name), `code` char(6), `inviteToken`, `ownerId` → users, `isDemo` bool, `createdAt` | unique(`nameKey`, `code`); `inviteToken` unique |
| **memberships** | `id`, `userId`, `houseId`, `status` (`pending`/`approved`/`declined`), `colorIndex` int (nullable until approved), `createdAt`, `decidedAt` (nullable), `setupDoneAt` (nullable: the post-approval setup) | unique(`userId`, `houseId`); index(`houseId`, `status`) |
| **quiet_times** | `id`, `userId`, `houseId`, `setId` uuid, `dayOfWeek` 0–6 (the night it **starts**), `startMinute`, `endMinute` (0–1425, step 15) | index(`houseId`); index(`userId`, `houseId`); `end <= start` = ends the next morning |
| **nudges** | `id`, `houseId`, `senderId`, `recipientId`, `messageIndex` 0–4, `isDemo` bool, `createdAt`, `acknowledgedAt` (nullable) | index(`senderId`, `createdAt`) for the cooldown; index(`recipientId`, `acknowledgedAt`) for pending; index(`houseId`, `createdAt`) for the streak |
| **heads_ups** | `id`, `houseId`, `authorId`, `text` (1–200), `at`, `createdAt` | index(`houseId`, `at`) |
| **push_subscriptions** | `id`, `userId`, `endpoint` **text**, `p256dh`, `auth`, `createdAt`, `updatedAt` | `endpoint` unique; index(`userId`) |
| **system_state** | `key` text, `value` timestamptz | `key` primary key. Keys: `heartbeatAt`, `lastDemoResetAt` |

`users.activeHouseId` → houses and `houses.ownerId` → users form a cycle. Prisma handles it with named relations.

**Where each thing lives, how it updates, and what happens when you come back:**
- **Sign-in token:** the phone's local storage. Written at sign-in, cleared at sign-out or on a 401. Coming back keeps you signed in for 30 days, but an iPhone Home Screen app has its own storage, so you sign in once there.
- **Theme, "welcome card seen", "toasted acks" and the return-to path:** the phone's local storage, per device.
- **Everything else:** Postgres, changed only through the backend. Coming back means `GET /me` and focus refetches, so you see the latest.
- **Never stored:** "resting now", "away" and the overnight segments are worked out on the phone; the streak, live heads-ups and the cooldown are worked out by the backend on request.

## File Structure
Every file belongs to a component heading (shown in brackets).

```
app/
├── docker-compose.yml          [Infrastructure and config]
├── README.md                   [Infrastructure and config]
├── .gitignore                  [Infrastructure and config]
├── scripts/init-env.sh         [Infrastructure and config]
├── devpost/                    Devpost learning workspace (scope, prd, spec, checklist, app-map)
├── docs/forge/research/        supporting research (web-push, scheduling-on-fly, nestjs-auth)
├── frontend/
│   ├── Dockerfile  .env.example  vercel.json                 [Infrastructure and config]
│   ├── index.html                                            [Look and Feel]
│   ├── package.json  vite.config.ts  tsconfig.json            [Frontend: App shell and routing]
│   ├── playwright.config.ts                                  [Testing]
│   ├── public/
│   │   ├── sw.js                                             [Frontend: Service worker]
│   │   ├── site.webmanifest  favicon.*  icon-*.png  maskable-*.png  apple-touch-icon.png  badge-96.png  [Look and Feel]
│   ├── src/
│   │   ├── main.tsx  App.tsx                                 [Frontend: App shell and routing]
│   │   ├── styles/tokens.css  global.css  fonts.ts           [Look and Feel]
│   │   ├── api/client.ts  types.ts  hooks/*.ts               [Frontend: API client and session]
│   │   ├── auth/AuthContext.tsx  RequireAuth.tsx             [Frontend: API client and session]
│   │   ├── push/register.ts  ios.ts                          [Frontend: Push setup]
│   │   ├── lib/quietTime.ts  time.ts  colors.ts  copy.ts     [Frontend: Shared lib]
│   │   ├── components/                                       [Frontend: Shared UI components]
│   │   │   TabBar  Button  Sheet  ConfirmDialog  Toast  Avatar  EmptyState  HouseCard
│   │   │   CooldownPill  NotificationSetup  NudgeOverlay  DemoWelcomeCard
│   │   └── screens/
│   │       ├── Landing.tsx  SignUp.tsx  SignIn.tsx           [Frontend: Auth screens]
│   │       ├── JoinByLink.tsx                                [Frontend: Join by link]
│   │       ├── onboarding/ HouseStep  RequestSentStep  SetupIntro  QuietTimeStep  NotificationsStep   [Frontend: Onboarding]
│   │       ├── schedule/ SchedulePage  DayView  WeekView     [Frontend: Calendar]
│   │       ├── schedule/QuietTimeEditor.tsx                  [Frontend: Quiet-time editor]
│   │       ├── schedule/NudgeSheet.tsx                       [Frontend: Nudge sheet]
│   │       ├── summary/ SummaryPage  StreakTile  RestingNow  HeadsUpList  PostHeadsUpSheet   [Frontend: Summary]
│   │       ├── houses/ HousesPage  CreateHouseSheet  JoinByIdSheet  RequestsList   [Frontend: Houses]
│   │       └── profile/ProfilePage.tsx                       [Frontend: Profile]
│   └── tests/unit/  tests/e2e/                               [Testing]
└── backend/
    ├── Dockerfile  fly.toml  .env.example                    [Infrastructure and config]
    ├── package.json  tsconfig.json  nest-cli.json  vitest.config.ts   [Backend: App bootstrap]
    ├── prisma.config.ts                                      [Backend: Database access]
    ├── prisma/schema.prisma  prisma/migrations/              [Data Model]
    ├── prisma/seed.ts                                        [Backend: Demo module]
    ├── src/
    │   ├── main.ts  app.module.ts  config.ts  prisma-exception.filter.ts   [Backend: App bootstrap]
    │   ├── prisma/prisma.service.ts                          [Backend: Database access]
    │   ├── auth/ controller  service  auth.guard  public.decorator  current-user.decorator  dto/   [Backend: Auth module]
    │   ├── me/ controller  service                           [Backend: Me]
    │   ├── houses/ controller  service  memberships  invites  demo.guard  dto/   [Backend: Houses module]
    │   ├── quiet-times/ controller  service  dto/            [Backend: Quiet times module]
    │   ├── nudges/ controller  service  messages.ts          [Backend: Nudges module (the kernel)]
    │   ├── summary/ controller  service  dto/                [Backend: Heads-ups and Summary module]
    │   ├── push/ controller  push.service  dto/              [Backend: Push module]
    │   ├── demo/ demo.service  demo-data.ts                  [Backend: Demo module]
    │   ├── scheduler/scheduler.service.ts                    [Backend: Scheduler]
    │   ├── health/ controller                                [Backend: Health]
    │   └── common/ vancouverTime  quietTimeOverlap  random   [Backend: Common utilities]
    └── test/ *.e2e-spec.ts  setup.ts                         [Testing]
```

## External Services and Dependencies

### Supabase (Postgres only)
- Used only as Postgres, through one Session-pooler connection string. We don't use Supabase Auth, the REST API or Realtime, and no Supabase key ships to the browser.
- **Connection:** `postgresql://prisma.<project-ref>:<password>@<pooler-host>:5432/postgres?sslmode=no-verify`.
  - The pooler works over IPv4.
  - `sslmode=no-verify` = encrypted without certificate checking (the learner's choice). `pg` treats `sslmode=require` as full verification, which fails against Supabase's own certificate authority.
- **Pool:** 5 connections (the free tier's session pool allows 15 per role). That leaves room for `migrate`, `psql` and seeding.
- **Free plan:** projects pause after 7 days of low activity. While the Fly machine runs, regular traffic keeps it active, and the daily heartbeat is a backup. The real risk is the machine being stopped, which restart policy `always` prevents.
- **Provisioning:** by the agent through the Supabase CLI after the learner's `supabase login` (see `Where It Runs and How Someone Tries It > Live`).
- **Docs:**
  - https://supabase.com/docs/guides/database/prisma
  - https://supabase.com/docs/guides/database/connecting-to-postgres
  - https://supabase.com/docs/guides/platform/free-project-pausing

### Fly.io (backend hosting)
- Deploys `backend/Dockerfile`'s `runtime` target. The config is `backend/fly.toml` (`Infrastructure and config`).
- **Cost:** about $3.69 a month, fixed (one 512 MB shared machine, always on; 2026-10-01 pricing).
- **Docs:**
  - https://docs.fly.io/reference/configuration
  - https://docs.fly.io/apps/app-availability
  - https://docs.fly.io/launch/autostop-autostart
  - https://docs.fly.io/about/pricing

### Vercel (frontend hosting)
- Builds `app/frontend` with the Vite preset. Hobby plan: free, non-commercial.
- **Env:** `VITE_API_URL`. The config is `frontend/vercel.json` (`Infrastructure and config`).
- **Docs:**
  - https://vercel.com/docs/frameworks/vite
  - https://vercel.com/docs/project-configuration
  - https://vercel.com/docs/cli

### Web Push (browser push services: Google, Mozilla, Apple)
- The backend sends `webpush.sendNotification(subscription, JSON.stringify(envelope), options)`, signed with the VAPID keys. The envelope, options and status handling are in `Backend: Push module`.
- Free, with no Apple Developer account.
- **iPhone:** iOS 16.4 or later, and only once Hushmate is added to the Home Screen; permission must come straight from a tap.
- **Declarative format:** iOS 18.4+ shows the envelope itself if the service worker fails. Chrome and Firefox deliver it as a normal push event to `sw.js`.
- **Never rotate the production VAPID keys:** that orphans every subscription.
- **Docs:**
  - https://github.com/web-push-libs/web-push
  - https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
  - https://webkit.org/blog/16535/meet-declarative-web-push/
  - https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
  - https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification

### The backend API contract
- **Base URL:** `VITE_API_URL`. JSON throughout. Every route needs `Authorization: Bearer` unless marked **public**.
- **Errors:** `{statusCode, message: string | string[], error?}`.
- **Status codes:**
  - 400 validation
  - 401 not signed in, or a bad token or credentials
  - 403 not allowed (demo lock, not a member, not the owner, not your active house)
  - 404 not found
  - 409 conflict (email taken, already a member, overlap)
  - 429 rate-limited or in cooldown (with `Retry-After` or `cooldownUntil`)

**Shared shapes:**
- `User` = `{id, name, email, isDemo, activeHouseId: string|null, nudgeCooldownUntil: string|null, demo?: {houseName, botNames: string[]}}`
- `House` = `{id, name, code}`

| Method & path | Body | Success | Errors |
|---|---|---|---|
| `POST /auth/signup` **public** | `{name, email, password}` | `201 {token, user: User}` | 400, 409, 429 |
| `POST /auth/signin` **public** | `{email, password}` | `200 {token, user: User}` | 400, 401, 429 |
| `GET /me` | none | `User` | 401 |
| `POST /houses` | `{name}` | `201 {house: House}` | 400, 403 (demo) |
| `GET /houses` | none | `[{membershipId, status, house: House, isActive, isOwner, pendingCount, setupDone}]` | |
| `GET /houses/lookup?id=` | none (`#` sent as `%23`) | `House` | 404 |
| `GET /invites/:token` **public** | none | `{name, code}` | 404 |
| `POST /houses/:id/join` · `POST /invites/:token/join` | none | `201 {membershipId, status: "pending"}` | 403 (demo account or demo house), 404, 409 |
| `GET /houses/:id/requests` | none | `[{membershipId, name, createdAt}]` | 403 |
| `POST /memberships/:id/approve` · `/decline` | none | `{status}` | 403, 404 |
| `POST /memberships/:id/setup-done` | none | `204` | 403 (not yours, or not approved), 404 |
| `DELETE /memberships/:id` | none | `204` | 403 (demo, or not yours), 404 |
| `POST /houses/:id/activate` | none | `{activeHouseId}` | 403 |
| `GET /houses/:id/invite-link` | none | `{url}` | 403 |
| `GET /houses/:id/board` | none | `{members: [{id, name, colorIndex, isAway, isYou}], quietTimes: [{id, userId, setId, dayOfWeek, startMinute, endMinute}]}` | 403 |
| `POST /houses/:id/quiet-times` | `{days, startMinute, endMinute}` | `201 {setId}` | 400, 403, `409 {conflicts}` |
| `PATCH /quiet-times/:id` | `{startMinute, endMinute, scope}` | `200` | 400, 403, `409 {conflicts}` |
| `DELETE /quiet-times/:id?scope=` | none | `204` | 403, 404 |
| `POST /nudges` | `{recipientId}` | `201 {cooldownUntil}` | 403, `429 {cooldownUntil}` |
| `GET /nudges/pending` | none | `[{id, message, subtitle: string\|null, isDemo, createdAt}]` | |
| `POST /nudges/acknowledge` | none | `{acknowledged: n}` | |
| `POST /houses/:id/heads-ups` | `{text, at}` | `201 {headsUp}` | 400, 403 |
| `GET /houses/:id/summary` | none | `{streakDays, isDemo, headsUps: [{id, text, at, authorName}], myAcks: [{nudgeId, recipientName, acknowledgedAt}]}` | 403 |
| `GET /push/vapid-public-key` **public** | none | `{key}` | |
| `POST /push/subscriptions` | `{endpoint, keys: {p256dh, auth}}` | `201` | 400 (unknown host) |
| `DELETE /push/subscriptions` | `{endpoint}` | `204` | |
| `GET /health` **public** | none | `200 {ok: true, db: true}` | `503 {ok: false, db: false}` |

## Important Failure Modes
- **A push doesn't arrive** (permission off, iPhone not on the Home Screen, expired subscription, push service 429/5xx) → the nudge is still pending, and the **overlay appears on the next open**. 404 or 410 deletes the subscription.
- **Safari revokes permission after a silent push** → prevented: `sw.js` always shows a notification, and the declarative envelope gives iOS 18.4+ its own fallback.
- **A bad VAPID subject or keys** → Apple answers 403 `BadJwtToken`. It's logged loudly, and subscriptions are kept. Boot fails if a `VAPID_*` variable is missing. Production keys are never rotated.
- **iPhone in Safari, not on the Home Screen** → Push setup shows the Add-to-Home-Screen steps and "sign in again". Everything else works.
- **The token expires (30 days)** → the 401 handler signs out locally (including unsubscribing push in the browser) and sends you to sign-in with return-to.
- **A deploy or crash around 3 AM, or a lost tick** → the minute tick's overdue-reset check runs the reset late. The reset is guarded, so it never runs twice.
- **A hung database or push call** → timeouts everywhere stop it freezing the minute job (`waitForCompletion` would otherwise skip every tick).
- **The machine stops** (crash loop, clean exit) → restart policy `always`. Without it, the timers would die and Supabase would pause after 7 days.
- **A second instance** (old app, a local backend pointed at production, a mistaken scale-up) → database claims and guards make every job idempotent. `SCHEDULER_ENABLED=false` switches off the timers in ad-hoc processes.
- **The database connection fails on deploy** (wrong pooler mode, user, password or SSL mode) → `/health` returns 503 and Fly flags the machine. The fix is the Session-pooler URL with `prisma.<ref>` and `sslmode=no-verify`.
- **The backend is unreachable or slow** → TanStack Query retries (except 4xx). Screens keep their last data with a plain "Can't reach Hushmate right now" line. Actions show an inline error, never a false success.

## What Was Simplified and Why
- **Own sign-in with a 30-day token in local storage**, instead of a hosted provider with refresh tokens, email verification and password reset. Reset and account editing are deferred in the PRD, and having no such endpoints is what locks the demo accounts. The XSS risk to the stored token is reduced by a strict CSP, no third-party scripts, and React-only text rendering. The fuller version would add a reset email flow and short-lived tokens.
- **Re-checking on load, focus and every 30 seconds, plus push for nudges**, instead of live sockets. Nudges are the only urgent event, and they already arrive by push.
- **Worked out on read** (streak, live heads-ups, resting, away, cooldown) instead of stored and kept up to date by jobs.
- **One time zone:** quiet times are wall-clock times read on each phone, and the server uses Vancouver days. A time zone per house comes later.
- **Bots are ordinary user rows** whose nudges use the real pipeline (labelled `isDemo` and subtitled, cooldown skipped). The kernel is never faked.
- **The connection to Supabase is encrypted but not certificate-checked** (`sslmode=no-verify`), the learner's choice for zero setup friction. Pinning Supabase's root certificate later would add checking.
- **Theme per device** (local storage) instead of a server-side setting.
- **No shared types package:** the frontend mirrors the API shapes in `api/types.ts`.
- **No calendar library:** two hand-built views (day and week).

## Decisions and Open Issues

### The learner's decisions (4-spec)
- **TypeScript, NestJS backend, React frontend.** Any CSS approach or UI library that respects the design language.
- **PWA without offline mode or install prompts.** "Whatever is necessary" for notifications.
- **Own sign-in in NestJS**, as part of the backend API.
- **Supabase** for the database (the agent provisions it through the CLI), **Fly.io** for the backend (a **new** app, one always-on machine), **Vercel** for the frontend, and a custom domain later.
- **A predictable bill**, and a **heartbeat write** so Supabase never pauses.
- **Docker:** compose for local development. The backend image deploys to Fly; the frontend goes to Vercel from source. Two project folders: `app/frontend/` and `app/backend/`.
- **Bot nudges are real notifications**, with the demo subtitle. The welcome card warns judges to sign out.
- **Accepted stack recommendations:** Vite, React Router, TanStack Query, CSS Modules + tokens, Radix primitives, hand-built calendar, date-fns, Prisma, @nestjs/schedule, web-push.
- **Decided at the first review:**
  1. Bots acknowledge a judge's nudge after about a minute.
  2. Overlapping quiet times are blocked, with a warning showing the clash.
  3. The bots Maya, Jordan and Priya, as proposed.
  4. Bots pause after the 3 AM reset until the app is next opened.
  5. Verification by automated tests plus push checked by hand on real phones.
- **Decided at the build-readiness check (2026-10-03):**
  - **A:** all the structural fixes.
  - **R1:** the sign-in defaults.
  - **R2:** the timer defaults.
  - **R3:** the push defaults, including the "h" badge icon.
  - **B1:** `GET /me` (fetched on every load) returns `nudgeCooldownUntil`.
  - **B2:** one source of truth for bot names. Bots are flagged `isBot` in the seeded data, and `GET /me` returns their names to demo accounts.
  - **B3:** house names 2–30 characters with no `#`; display names 1–30 characters.
  - **4:** Vitest everywhere ("do whatever"). The agent picked it as the NestJS 12 default, with one runner for the whole repo.
  - **5:** a bot owns the demo house. The agent picked **Maya**. Join requests to it are refused.
  - **6:** invite links are remembered through sign-up and sign-in.
  - **7:** the simplest, frictionless Supabase connection for an AI agent to deploy: `sslmode=no-verify`.
  - **8:** the declarative push envelope with `mutable: true`.
  - **9:** a **Notifications row in Profile**.
  - **10:** the join-approved copy "You're in! {House} approved your request."

### Decided at the design review (2026-10-04)
Mockups in `docs/forge/design/`. Each line is one decision; the sections above already reflect it.
- 2026-10-04: **Week view** uses pastel stripes with a name legend and tap-through to the day view, instead of name and time in each block.
- 2026-10-04: **Toasts** have a neutral dot. Mint stays only on the acknowledgement toast.
- 2026-10-04: **Joining is two steps.** A join request ends onboarding at Request sent; setup (first quiet times, notifications) runs after approval, tracked by `memberships.setupDoneAt` and `POST /memberships/:id/setup-done`.
- 2026-10-04: **No view of an inactive house's quiet times.** The PRD criterion was dropped.
- 2026-10-04: **Token override:** `--hm-border-control` `#6B77A9` dark / `#847D91` light, so control borders reach 3:1 on surface-2.
- 2026-10-04: **The nudge overlay card rises 8px** (`--hm-rise`).
- 2026-10-04: **House names have no spaces** (2–30 characters, no `#`). This supersedes B3's house rule; the seeded demo house is exempt.
- 2026-10-04: **The acknowledgement card names who tapped Got it** (now promised in the PRD).
- 2026-10-04: The nudge sheet says **"Not resting"**; **Resting now** excludes you; the Schedule header gets **+**, day arrows and the Day/Week toggle.

### Agent details, changeable at review
- The JWT is stored in local storage as a bearer token, because cross-site cookies between `vercel.app` and `fly.dev` would be blocked by Safari.
- `GET /invites/:token` is public, so a signed-out invitee sees the house name. Any approved member can share the invite link.
- Fly at 512 MB rather than 256 MB, to leave NestJS and Prisma headroom.
- Demo logins `judge1–3@example.com`, and bot emails `*.bot@example.com` (a reserved domain that can never receive mail). The demo house code is `202610`.
- The theme is stored per device.

### Things the learner was unsure about (the useful unknowns)
1. **"Regular web app" vs PWA.** *Clarified:* notifications while closed need a service worker, and iPhone needs a manifest for the Home Screen; that's the minimum PWA. *Outcome:* a PWA without offline mode or install prompts.
2. **"Always-on machine: wouldn't that be expensive?"** *Clarified:* Fly bills per second for running machines. One small always-on machine is about $2.19–3.69 a month, and the bill stays fixed with the pinned config. *Outcome:* one always-on machine, which also hosts the timers. *Check:* `fly scale show` after the first deploy, and the bill after the first week.

### Verification results (2026-10-03, at the learner's request)
| Item | Result | Source |
|---|---|---|
| **Node 24 image** | ✅ `node:24-bookworm-slim` exists (updated 2026-09). LTS until 2028-04-30 | nodejs.org release index, Docker Hub, nodejs/Release |
| **Fly's default of 2 machines** | ✅ `fly launch --ha=false`, or `fly scale count 1` afterwards. Always-on = `auto_stop_machines = "off"` | https://docs.fly.io/apps/app-availability, https://docs.fly.io/launch/autostop-autostart |
| **Prisma + Supabase connection** | ⚠️ **Corrected:** one Session-pooler URL (5432), a `prisma` user, `prisma.config.ts` + `@prisma/adapter-pg`. Pin `prisma@7` | https://supabase.com/docs/guides/database/prisma, npm |
| **Package majors** | ⚠️ NestJS 12 (ESM + Vitest default), Vite 8, React Router 8, Vitest 5 | npm, https://docs.nestjs.com/fundamentals/testing |
| **Research** | ✅ Three reports in `docs/forge/research/`: Web Push, timers on Fly, sign-in. Their accepted defaults are folded into this spec | the files' own sources (accessed 2026-10-03) |
| **iPhone Home Screen push** | ⏳ Needs the deployed HTTPS skeleton and a real iPhone on iOS 16.4+. The iOS Simulator's Web Push support is undocumented | Apple, WebKit |

### Open issues
- *(Verify early, build slice 1)*:
  - iPhone Home Screen push on the learner's phone, using the 13-step checklist in `docs/forge/research/web-push.md` §7. This includes whether iOS honours `mutable: true` (if not, the overlay still appears on focus).
  - That Fly overwrites a client-sent `Fly-Client-IP` header (curl the deployed API with a forged header).
  - How long one argon2 hash takes on the real Fly machine (target well under 1 s).
  - That `sslmode=no-verify` connects through `@prisma/adapter-pg` to the Supabase pooler.
  - `fly config validate --strict` passes, and `fly machine status` shows restart policy `always`.
  - How to read the pooler host from the Supabase CLI or Management API during provisioning.
- **Build order hint for `5-build`** (risk first):
  1. A deployed skeleton: provision Supabase, Fly and Vercel; backend `/health`; the frontend with the service worker and manifest; the iPhone push check.
  2. Sign-in.
  3. Houses.
  4. **The nudge round trip with real push on two phones.**
  5. Quiet times and the calendar.
  6. Summary.
  7. The demo house, bots and timers.
