# Hushmate

Less shush, more hush. A mobile-first web app (PWA) for housemates to share quiet hours and send gentle nudges.

## Try it

- Web app: https://hushmate-kappa.vercel.app
- API: https://hushmate-api.fly.dev

### Demo logins

Three shared demo accounts sign you into **DevPost Demo House**, a house with three simulated housemates (Maya, Jordan and Priya). Their quiet times, heads-ups and nudges are scripted.

| Email | Password |
|---|---|
| `judge1@example.com` | `HushmateDemo2026` |
| `judge2@example.com` | `HushmateDemo2026` |
| `judge3@example.com` | `HushmateDemo2026` |

- The first demo nudge arrives within about a minute of opening the app, then one every 5 to 10 minutes. Nudge a housemate and the simulated housemate taps "Got it" about 10 seconds later.
- The demo house resets every night at 3 AM Vancouver time. Demo accounts are locked: they can't change the house, their profile or their password.
- **Sign out when you are done.** The accounts are shared, and nudges keep arriving on any device that is still signed in. Signing out stops them on that device.

### iPhone

Notifications on iPhone need the app on the Home Screen:

1. Open the live URL in Safari, tap Share, then **Add to Home Screen**.
2. Open Hushmate from the Home Screen icon (not from Safari).
3. Sign in again; the Home Screen app keeps its own session.
4. Turn on notifications when the app asks.

### Notifications on desktop

- **Brave:** enable "Use Google services for push messaging" at `brave://settings/privacy`.
- **Chrome on macOS:** allow notifications for Chrome in System Settings, then Notifications.
- **Safari:** nudges are shown, but the in-app overlay can take up to about 15 seconds to appear while the app is open.

## Run it locally

Needs Docker (or OrbStack), `openssl`, and Node 24+ on the host for tooling.

From this folder:

```bash
./scripts/init-env.sh                        # creates backend/.env and frontend/.env; fills JWT_SECRET and VAPID keys (never printed)
docker compose up --build -d                 # db (postgres:17) + backend (watch mode) + frontend (Vite)
docker compose exec backend npx prisma migrate dev
```

- Web app: http://localhost:5173
- API: http://localhost:3000 (`curl localhost:3000/health` returns `{"ok":true,"db":true}`)
- Postgres: `localhost:5432`, user, password and database all `hushmate` (local only). A second database, `hushmate_test`, is created for the e2e tests.

Stop with `docker compose down` (keeps data) or `docker compose down -v` (wipes the local database).

A local backend must only ever use the compose database. Never put the production `DATABASE_URL` in `backend/.env`.

## License

Unlicensed. Built for the Devpost Build With AI: Basics hackathon; all rights reserved.
