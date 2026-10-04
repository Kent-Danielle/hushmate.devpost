# Research: Web Push from NestJS (VAPID) and the iOS Home Screen rule

- **Status:** research aid only. Nothing here is a decision. Items marked *Recommendation, not a decision* need the learner's ruling.
- **Date:** 2026-10-03. Sources are listed at the end as [S#]; all were accessed on 2026-10-03.
- **Fixed inputs (not reopened):** TypeScript; NestJS 12 on one always-on Fly.io machine (Node 24, `node:24-bookworm-slim`); React 19 + Vite 8 PWA on Vercel with no offline mode and no install prompts (only `public/sw.js` + `site.webmanifest`); `web-push` 3.6.x with VAPID; only two payload types, `nudge` and `join-approved`; a nudge never reveals its sender.
- **Read against:** `devpost/prd.md` (Notifications, Nudging, Acknowledging a Nudge, Onboarding, Demo House) and `devpost/spec.md` (the headings cited in the last section).

## 1. Questions
1. How should NestJS send with `web-push`? This covers VAPID keys, the subject, payload size, TTL/urgency/topic, status codes, Apple's endpoint, and sending to several devices.
2. What exactly is the iOS 16.4+ Home Screen rule? This covers standalone detection, the user-gesture permission, manifest needs, iOS behaviour differences, and whether to use Declarative Web Push (iOS 18.4+).
3. How should the service worker work on Vite + Vercel? This covers root scope, cache headers, registration timing, `showNotification` options, `notificationclick`, and `postMessage` to open pages.
4. How do we test it? This covers localhost, Chrome DevTools, the iOS Simulator, and what only a real iPhone can confirm.

## 2. Findings
**Q1: `web-push` and the push services**
- **Version facts.** npm `latest` is **3.6.7**, published 2024-01-16, CommonJS, `engines: node >= 16` [S3]. The GitHub `master` branch is ESM and **unreleased**. Some docs (including Context7's) show ESM named imports from master, which don't apply to 3.6.7. Types come from `@types/web-push` 3.6.4.
- **Keys.** `webpush.generateVAPIDKeys()` or the CLI `web-push generate-vapid-keys [--json]` produce URL-safe base64 `publicKey`/`privateKey` [S1]. Subscriptions are bound to the public key used at subscribe time. Changing keys orphans every subscription (Apple reports this as `VapidPkHashMismatch`) [S4].
- **Subject.** `setVapidDetails(subject, publicKey, privateKey)` throws unless the subject is a parseable `https:` or `mailto:` URL, and warns on `localhost` [S2]. Apple rejects `https://localhost` subjects with **403 `BadJwtToken`** [S1][S4].
- **JWT.** web-push signs a **fresh JWT on every send**, with a default expiry of 12 h and a maximum of 24 h [S2]. Apple asks that the expiry be ≤ 1 day and the JWT be refreshed no more than once an hour [S4]. Hushmate's volume (a few pushes per hour) makes that guidance low risk.
- **Options.** `sendNotification(sub, payload, options)` accepts only these keys: `headers`, `gcmAPIKey`, `vapidDetails`, `TTL`, `contentEncoding`, `urgency`, `topic`, `proxy`, `agent`, `timeout`. Any other key **throws** [S2].
  - `TTL`: the default is **4 weeks** (2,419,200 s). Apple requires a positive TTL [S2][S4].
  - `urgency`: `very-low | low | normal | high`. Apple says to use `high` "to deliver immediately" [S4].
  - `topic`: up to 32 URL-safe base64 characters. A new message replaces a *pending* one with the same topic [S2][S14].
  - `contentEncoding`: the default is `aes128gcm`.
  - `timeout`: unset by default, so a stuck socket can hang.
- **Payload size.** Push services must accept 4096 bytes [S14], and Apple caps the payload at 4 KB (`PayloadTooLarge`, 413) [S4]. web-push **doesn't check** size [S2]. Hushmate's payloads are about 300 bytes.
- **Results.** On success the promise resolves `{statusCode, body, headers}`. Any non-2xx rejects with `WebPushError {statusCode, headers, body, endpoint}`. Other failures (bad input, socket errors) reject with a plain `Error` [S2]. What the status codes mean, per Apple [S4] and web.dev [S14]:

| Code | Meaning | Handling |
|---|---|---|
| 201 | accepted | done |
| 404 / 410 | endpoint unknown / expired | delete the subscription row |
| 413 | payload too large | a bug; log it, never retry |
| 429 | rate limited (`Retry-After`) | log; drop it (the overlay is the fallback) |
| 400 / 401 / 403 | malformed request / bad VAPID JWT, key or subject | config bug: log loudly, **don't** delete the row |
| 5xx | push service trouble | log; at most one delayed retry |

- **Apple specifics.** Endpoints are `https://web.push.apple.com/...`, and servers must be able to reach `*.push.apple.com` [S4][S5]. No Apple Developer account is needed [S4][S5]. The `reason` field in the body is helpful: `BadJwtToken`, `BadVapidPublicKey`, `VapidPkHashMismatch`, `PayloadTooLarge`, `TooManyRequests` [S4].
- **Other push services.** Chrome's endpoints are on `fcm.googleapis.com`, Firefox's on `updates.push.services.mozilla.com`, and Edge's on `*.notify.windows.com`. The server makes an outbound HTTPS POST to whatever URL the client sends.

**Q2: the iOS rule**
- **Where push works.** Web Push on iPhone works only in a **Home Screen web app**, on iOS/iPadOS 16.4+ [S4][S5]. In a Safari tab, `Notification` isn't available (a ReferenceError), and `PushManager` exists only in Home Screen apps [S10].
- **Permission.** It must come from a gesture. Apple says to call subscribe **immediately** from the tap handler [S4][S5].
- **Manifest.** Before iOS 26 it needed `display: standalone` or `fullscreen` [S5]. On **iOS 26, any site added to the Home Screen opens as a web app by default**, and the user can switch "Open as Web App" off [S9]. The logo kit's manifest already has `display: standalone`.
- **No silent pushes.** Safari **revokes permission** if the service worker doesn't show a notification for a push [S4]. Chrome needs `userVisibleOnly: true` [S11].
- **Ignored options on iOS.** `tag`, `renotify`, `icon`, `badge`, `image`, `actions`, `requireInteraction` and `vibrate` have no effect on iOS. `Notification.data` works from iOS 16.4 [S10]. iOS uses the Home Screen icon.
- **Badges.** The Badging API (`navigator.setAppBadge`) exists for Home Screen apps [S5]. The PRD has no badges, so skip it.
- **Separate storage.** **Home Screen apps don't share storage with Safari** [S18]. After Add to Home Screen the user is signed out in the app (the token lives in local storage), and the app has its own service worker registration.
- **Standalone detection.** Check `matchMedia('(display-mode: standalone)').matches || navigator.standalone === true`. `navigator.standalone` is non-standard and WebKit-only [S13]. Prefer feature detection over user-agent sniffing [S5]: `'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window`. Use the user agent only to choose the "add to Home Screen" copy. iPadOS reports a Mac UA, so check `Macintosh` plus `navigator.maxTouchPoints > 1`.
- **Declarative Web Push** [S6][S7][S8]:
  - **Support:** iOS/iPadOS 18.4+ (Home Screen apps) and Safari 18.5+ on macOS. Chrome, Edge and Firefox **don't support it** as of 2026; Mozilla's standards position is positive [S19].
  - **Format:** JSON `{"web_push": 8030, "notification": {"title", "navigate", "body", "tag", "lang", "dir", "silent", "data", ...}, "mutable": bool}`. `title` and `navigate` are required.
  - **`mutable` absent:** Safari shows the notification itself, **no `push` event fires**, and a tap navigates to `navigate` [S7][S8].
  - **`mutable: true`:** the `push` event fires (with `event.notification`). A notification the service worker shows replaces the proposed one. If the worker fails, **the declarative fallback is still shown**, so there's no silent-push revocation [S6][S7].
  - **Where it isn't supported:** the same bytes arrive as an ordinary `push` event, and the worker renders them ("handled imperatively as it always had been") [S6][S8]. The format is therefore compatible with Chrome and Firefox as long as `sw.js` reads it.
  - **Uncertain:** one 2026 third-party article calls `mutable` "a future revision" [S19], while WWDC25 [S7] and the Push API draft [S8] describe it as shipped. Check it on the real iPhone.

**Q3: the service worker on Vite + Vercel**
- **Root scope.** Vite copies `public/sw.js` to `/sw.js` as is, so `register('/sw.js')` gets the default scope `/` and no `Service-Worker-Allowed` header is needed. Vercel serves real files **before** rewrites ("precedence is given to the filesystem prior to rewrites") [S16], so the SPA catch-all doesn't hide `/sw.js`.
- **Cache headers.** Vercel's default is `Cache-Control: public, max-age=0, must-revalidate`, and its CDN cache is per deployment [S16]. Browsers also skip the HTTP cache for the main SW script by default (`updateViaCache: 'imports'`). They re-check it on navigation and on `push` (at most once every 24 h on push) and treat any byte change as an update [S15]. So updates roll out without special config. An explicit `no-cache` header on `/sw.js` is belt and braces.
- **Lifecycle.** With no caches, `self.skipWaiting()` in `install` plus `clients.claim()` in `activate` is safe, and new code applies at once [S15].
- **Messaging open pages.** Use `clients.matchAll({type: 'window', includeUncontrolled: true})`. Without `includeUncontrolled`, a page loaded before the worker took control is missed [S12].
- **Opening the app.** `clients.openWindow(url)` needs the activation that a notification click provides, and returns `null` for cross-origin URLs [S12]. On iOS, a known `openWindow` failure turned out to be **localhost-only** and went away on HTTPS [S18].

## 3. Options (within the decided stack)
**A. Push payload format**

| Option | What | For | Against |
|---|---|---|---|
| A1 (spec today) | Custom JSON `{type, body, isDemo}`; `sw.js` builds the notification | Simplest; same path everywhere | On Safari, one SW bug or a stale worker means a silent push and **permission revoked** |
| A2 | Declarative envelope + `mutable: true`; `sw.js` reads `payload.notification` in every browser | Safari 18.4+ always shows *something*; one format; still runs the SW for `postMessage` on Chrome, Firefox and (if `mutable` works) iOS | Slightly bigger payload; `mutable` status needs a device check |
| A3 | Declarative without `mutable` | No SW work on iOS 18.4+ | No `postMessage` on iOS (the overlay waits for a refocus); Chrome and Firefox still need the SW path |

**B. VAPID public key on the client.** Options: B1 `GET /push/vapid-public-key` (spec), B2 a build-time `VITE_VAPID_PUBLIC_KEY`, or B3 B1 **fetched before the tap**. With B1 fetched *inside* the tap handler, the gesture can be lost before subscribe on iOS. B2 couples a Vercel rebuild to key changes.

**C. When to send.** C1 awaits the push inside `POST /nudges`: simple, but a slow push service delays the toast. C2 commits the nudge, then sends without awaiting (catch and log everything). C3 uses a job queue, which is overkill on one machine.

**D. Foreground behaviour.** D1 always shows the notification **and** sends `postMessage`. D2 skips the notification when a window is focused, which breaks the Safari rule [S4] and Chrome's `userVisibleOnly`. Only D1 is valid.

**E. Sign-out.** E1 does a server `DELETE` only. E2 does `DELETE`, and if that fails, `subscription.unsubscribe()` so the endpoint later returns 410. Unsubscribing every time would force a new gesture on the next sign-in.

## 4. Gotchas an implementer will hit
1. **Silent push revokes permission on Safari.** Wrap all `push` work in `event.waitUntil(...)`. Always call `showNotification`, even if JSON parsing fails (use generic text). Never `return` early.
2. **Separate storage on iOS.** A user who signs up in Safari and adds Hushmate to the Home Screen opens the app **signed out**, at `start_url` `/`. Notification setup must be reachable after that sign-in, not only inside first-run onboarding.
3. **Losing the tap.** Any `await fetch(...)` before `subscribe()` in the tap handler can lose user activation on iOS. Prefetch the key and get `registration` (`navigator.serviceWorker.ready`) on screen mount. Then call `Notification.requestPermission()` and `pushManager.subscribe()` straight from the handler.
4. **The key format.** Pass `applicationServerKey` as a `Uint8Array` decoded from base64url. MDN allows a string, but bytes are safest across engines [S11].
5. **The worker can't read local storage.** A `pushsubscriptionchange` handler can't call the authenticated API. Re-sync from the page instead: on every app open with `Notification.permission === 'granted'`, call `getSubscription()` and `POST` it (the upsert).
6. **A shared phone must not get someone else's nudges.** The upsert by `endpoint` must **reassign `userId`** to the caller. A sign-out `DELETE` that silently fails (offline) leaves the old user's nudges arriving on the device. Re-POST on sign-in, plus E2.
7. **Endpoints are capability URLs.** The endpoint plus its keys let anyone push to that device. Don't log them in full (log `new URL(endpoint).host`), and never return them from the API.
8. **SSRF.** `POST /push/subscriptions` makes the server POST to a URL the client chose. Validate `https:` and an allowlist of push hosts (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`), or at least reject private IPs.
9. **Wrong VAPID subject.** A `https://localhost` subject means 403 `BadJwtToken` from Apple. Use a real `mailto:` with no spaces or angle brackets. Different keys locally and in production are fine, but **never rotate** the production keys.
10. **Unknown option keys throw.** For example, `ttl` (lowercase) throws inside `sendNotification`. Use `TTL`.
11. **Hung sockets.** There's no default `timeout`, so set one (about 10 s) so a hung push service doesn't stall the every-minute cron.
12. **Several devices.** Send with `Promise.allSettled` over the user's subscriptions and handle each result on its own. One dead endpoint must not hide the others.
13. **`tag` behaves differently per browser.** On Chrome, a same-`tag` notification silently replaces the old one unless `renotify: true` is set (Firefox and Safari ignore `renotify`; `renotify` with an empty `tag` throws `TypeError`) [S10]. On iOS `tag` does nothing, so every nudge stacks.
14. **The Android status-bar badge.** Chrome Android shows `badge` (a monochrome ~96 px PNG) in the status bar. The logo kit has none.
15. **Long body text.** Message plus demo subtitle is about 190 characters, which can truncate on the iOS lock screen. Check it on a device before the video.
16. **A missing `sw.js`.** If it is ever absent, the SPA rewrite serves `index.html` and registration fails with a MIME error. Check `curl -I https://<app>/sw.js` returns `200` with a JavaScript type.
17. **Uncontrolled pages.** Without `clients.claim()` or `includeUncontrolled: true`, the first page load never gets `postMessage`.
18. **Column width.** Keep `endpoint` as `text` (Prisma `String`). Don't cap it at `VarChar(255)`; Apple and FCM endpoints are long.

## 5. Recommended defaults (*Recommendation, not a decision*)
- **Payload: A2.** A declarative envelope with `mutable: true`. The backend composes the final text in `messages.ts`, which is one source for the demo subtitle.
  - nudge: `{web_push: 8030, mutable: true, notification: {title: "Hushmate", body, navigate: FRONTEND_ORIGIN + "/schedule", tag: "nudge", lang: "en", data: {type: "nudge"}}}`
  - join-approved: the same envelope with `tag: "join-approved"`, `navigate` set to `/houses`, and a body naming the house.
  - No sender id or name anywhere, including `topic` (sent in clear to the push service).
- **Send options:**
  - nudge: `{TTL: 1800, urgency: 'high', topic: 'nudge', timeout: 10000}`
  - join-approved: `{TTL: 86400, urgency: 'normal', topic: 'join-approved', timeout: 10000}`
  - A stale nudge is noise, and the overlay covers late arrivals.
- **Sending (C2).** `setVapidDetails` once in `onModuleInit`, failing boot if a `VAPID_*` env var is missing. Send after the database commit, and apply the status table in §2.
- **Key (B3).** Keep the endpoint, and fetch it when Push setup mounts.
- **Service worker:**
  - install → `skipWaiting`; activate → `clients.claim`
  - push → parse, then `showNotification(n.title, {body, tag, renotify: true, icon: '/icon-192.png', badge: '/badge-96.png', lang, data: {...n.data, url: n.navigate}})`, then `postMessage({type})` to every window client
  - notificationclick → `close()`, focus a same-origin client (then `postMessage`), else `openWindow(data.url)`
- **Page.** A `navigator.serviceWorker` `message` listener invalidates the TanStack `['nudges','pending']` query. The server stays the source of truth for the overlay text.
- **Push setup** (states in this order):
  1. Unsupported browser: explain, and carry on.
  2. iOS and not standalone: show the Add to Home Screen steps (Share → Add to Home Screen; on iOS 26 keep "Open as Web App" on).
  3. `denied`: no nagging; one line pointing to Settings → Notifications → Hushmate.
  4. `default`: show the button.
  5. `granted`: re-sync silently.
  Also offer a persistent "Turn on notifications" entry outside onboarding (see the spec gaps).
- **Vercel.** Optionally add `headers` for `/sw.js` (`Cache-Control: no-cache`) in `vercel.json`. Leave the rewrite as is.
- **Manifest.** Optionally add `"id": "/"` and `"scope": "/"`; iOS uses `id` for Focus sync [S5].

## 6. Code-level pointers (names only)
- **Backend:**
  - `import webpush from 'web-push'` (CommonJS default-import interop), or `import * as webpush` with CommonJS output.
  - Functions: `webpush.setVapidDetails`, `webpush.sendNotification`, `webpush.WebPushError` (`.statusCode`, `.body`, `.headers`, `.endpoint`), `webpush.generateVAPIDKeys`.
  - Validate the DTO with class-validator (`@IsUrl({protocols:['https']})`, `keys.p256dh` and `keys.auth` as strings).
  - Prisma `upsert` on `where: {endpoint}` with `update: {userId, p256dh, auth}`.
- **Page:**
  - `navigator.serviceWorker.register('/sw.js')` after `window` `load`; it's idempotent, so StrictMode is fine.
  - Subscription: `navigator.serviceWorker.ready`, `registration.pushManager.getSubscription()`, `.subscribe({userVisibleOnly: true, applicationServerKey})`, `subscription.toJSON()` → `{endpoint, keys:{p256dh, auth}}`, `subscription.unsubscribe()`.
  - Permission and detection: `Notification.permission`, `Notification.requestPermission()`, `matchMedia('(display-mode: standalone)')`, `navigator.standalone`.
- **Service worker:**
  - Events: `self.addEventListener('install'|'activate'|'push'|'notificationclick')`, `event.waitUntil`.
  - Push data: `event.data?.json()`, `event.notification` (declarative, Safari 18.4+).
  - Showing: `self.registration.showNotification`, `self.registration.getNotifications({tag})`. The page can call `getNotifications` after **Got it** to close leftover nudge notifications (optional).
  - Clients: `clients.matchAll`, `WindowClient.focus()`, `clients.openWindow`, `Client.postMessage`.
- **Headers on the wire:** `TTL`, `Urgency`, `Topic`, `Content-Encoding: aes128gcm`, `Authorization: vapid t=<jwt>, k=<publicKey>` [S2].

## 7. Testing
- **localhost.** It counts as a secure context, so desktop Chrome, Edge and Firefox can subscribe and receive real pushes at `http://localhost:5173`, sent by the dev backend through FCM or Mozilla. Phones need the HTTPS deployment.
- **Chrome DevTools** → Application → Service workers:
  - The **Push** text box sends a custom payload, delivered as `event.data` [S17]. Paste the A2 JSON to test `sw.js` without the backend.
  - **Update on reload** helps while editing `sw.js`.
  - Application → Background services → **Push messaging** records real push events [S17].
- **iOS Simulator: uncertain.** Simulator supports *native* remote notifications on macOS 13+ on Apple silicon or T2 Macs, and `xcrun simctl push` targets app bundle IDs. I found **no official Apple statement that the Simulator delivers Web Push to Home Screen web apps**, and third-party guides say to use a real device. Treat the Simulator as useful only for layout, standalone detection and the Add-to-Home-Screen flow. A real iPhone is the deciding test, as `spec.md` already says.
- **Real iPhone checklist** (iOS ≥ 16.4; on 18.4+ it also covers declarative):
  1. Safari → Share → Add to Home Screen ("Open as Web App" on).
  2. Launch from the icon and sign in again.
  3. Tap **Turn on notifications** → Allow.
  4. The database row has host `web.push.apple.com`.
  5. Lock the phone, then nudge from a second device: it arrives within seconds with no sender name, and the demo subtitle isn't cut off.
  6. Tap it → the app opens → overlay → **Got it**.
  7. With the app open in the foreground, a nudge shows the overlay at once (this tests `postMessage` and `mutable`).
  8. Swipe the app away, then nudge: it still arrives.
  9. Sign out, then nudge that account: nothing arrives.
  10. Deny permission: the app still works.
  11. Delete the icon, then nudge: the logs show 410 and the row is deleted.
  12. Safari tab (not the Home Screen app): shows the Add-to-Home-Screen steps, with no permission button.
  13. Note any delay from Focus or Scheduled Summary.
- **Android (Chrome):** check the status-bar badge icon, and that a second nudge alerts again (`renotify`).

## 8. Spec gaps or contradictions
1. **`Frontend: Onboarding` / `Frontend: Push setup`.** Notification setup exists only in first-run onboarding. Because Home Screen storage is separate [S18], an iPhone user finishes onboarding in Safari, adds the app, signs in again, and has **no path** to turn notifications on. Add a persistent entry (for example in Profile, or a banner when standalone and `permission === 'default'`).
2. **`Frontend: Push setup`.** "with the key from `GET /push/vapid-public-key`" doesn't say *when*. Fetching it inside the tap handler risks the iOS gesture rule [S4]; prefetch it. The section also doesn't cover the unsupported-browser state (iOS < 16.4, in-app browsers) or the `denied` state.
3. **`Frontend: Service worker`.** `showNotification("Hushmate", { body, tag: "nudge", data })`:
   - There's no `renotify`, so on Chrome a repeat nudge replaces the old one silently.
   - `tag` does nothing on iOS [S10].
   - It doesn't specify `waitUntil`/always-show, `skipWaiting`/`claim`, `includeUncontrolled`, or `icon`/`badge`.
   - It doesn't describe the **join-approved** notification at all: no title, body, tag or click target.
4. **`Backend: Push module` vs `Frontend: Service worker`.** The payload is `{type:"nudge", body, isDemo}`, but the SW section says the SW makes "the message plus the demo subtitle". It's ambiguous who appends the subtitle; `Backend: Nudges module` puts it in `messages.ts`. Have the backend compose the final text, which A2 needs anyway.
5. **`External Services and Dependencies > Web Push`.**
   - Only 201 and 404/410 are covered; 400/401/403 (VAPID config), 413, 429 and 5xx aren't.
   - `{ TTL: 3600 }` is the same for both types, and `urgency`, `topic` and `timeout` aren't set.
   - The section doesn't mention Safari's permission revocation for silent pushes [S4], or that `web-push` 3.6.7 is CommonJS while the GitHub docs show unreleased ESM [S3].
6. **`Backend: Push module`.**
   - "upsert by `endpoint` for the current user" should state that the upsert **moves** an existing endpoint to the new user (gotcha 6).
   - There's no endpoint host allowlist (SSRF, gotcha 8).
   - There's no re-sync on app open (gotcha 5).
   - It doesn't say whether `sendToUser` is awaited inside `POST /nudges` (option C).
7. **`Frontend: Profile` (sign out) / `The Core Journey Through the System > B.6`.** These assume `DELETE /push/subscriptions` succeeds. There's no fallback if it fails (option E2), and nothing re-POSTs on the next sign-in.
8. **`Important Failure Modes`.** These are missing:
   - Safari revoking permission after a push with no notification.
   - Rotating VAPID keys orphaning all subscriptions.
   - Push service 429 or outages.
   - Apple 403 `BadJwtToken` from a bad `VAPID_SUBJECT`.
9. **`Look and Feel` (App icons and manifest).** The kit has no monochrome **badge** icon for Android, and `site.webmanifest` has no `id`/`scope` (optional).
10. **`Decisions and Open Issues > Verification results`.** "The agent can try the iOS Simulator first": Simulator support for Web Push to Home Screen apps is undocumented. Expect a real iPhone to be needed, and Declarative Web Push isn't weighed anywhere in the spec (options A1–A3).
11. **Minor, `Where It Runs and How Someone Tries It > Locally`.** Firefox also works for localhost push, not only Chrome and Edge.

## Sources (all accessed 2026-10-03)
- [S1] web-push README (v3.6.7): https://github.com/web-push-libs/web-push/blob/v3.6.7/README.md (also via Context7 `/web-push-libs/web-push`)
- [S2] web-push source v3.6.7, `src/web-push-lib.js` and `src/vapid-helper.js`: https://github.com/web-push-libs/web-push/tree/v3.6.7/src
- [S3] npm registry, `npm view web-push` (3.6.7, 2024-01-16, CommonJS) and the master `package.json` (`"type": "module"`, unreleased)
- [S4] Apple, "Sending web push notifications in web apps and browsers": https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- [S5] WebKit, "Web Push for Web Apps on iOS and iPadOS": https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- [S6] WebKit, "Meet Declarative Web Push": https://webkit.org/blog/16535/meet-declarative-web-push/
- [S7] WWDC25 session 235, "Learn more about Declarative Web Push": https://developer.apple.com/videos/play/wwdc2025/235/
- [S8] W3C Push API (Editor's Draft, declarative push message, `mutable`): https://w3c.github.io/push-api/
- [S9] WebKit, "WebKit Features in Safari 26.0" (Open as Web App by default): https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- [S10] MDN `showNotification`: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification and MDN browser-compat-data `api/Notification.json`, `api/ServiceWorkerRegistration.json`: https://github.com/mdn/browser-compat-data
- [S11] MDN `PushManager.subscribe()`: https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
- [S12] MDN `Clients.openWindow()` and `Clients.matchAll()`: https://developer.mozilla.org/en-US/docs/Web/API/Clients/openWindow, https://developer.mozilla.org/en-US/docs/Web/API/Clients/matchAll
- [S13] MDN `display-mode`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode
- [S14] web.dev, "The Web Push Protocol": https://web.dev/articles/push-notifications-web-push-protocol
- [S15] web.dev, "The service worker lifecycle": https://web.dev/articles/service-worker-lifecycle
- [S16] Vercel, vercel.json rewrites (filesystem precedence): https://vercel.com/docs/project-configuration/vercel-json#rewrites and Cache-Control defaults: https://vercel.com/docs/caching/cache-control-headers
- [S17] Chrome DevTools, Push text box (DevTools 63): https://developer.chrome.com/blog/new-in-devtools-63 and Background services: https://developer.chrome.com/docs/devtools/javascript/background-services
- [S18] WebKit bug 181849 (Home Screen storage isolated, "by design"): https://bugs.webkit.org/show_bug.cgi?id=181849 and bug 259212 (`openWindow` on iOS, fixed by HTTPS): https://bugs.webkit.org/show_bug.cgi?id=259212
- [S19] Aimtell, "The State of Declarative Web Push in 2026" (third-party; used only for cross-browser status): https://aimtell.com/blog/state-of-declarative-web-push-2026
