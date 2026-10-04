# Hushmate

Less shush, more hush. A mobile-first web app (PWA) for housemates to share quiet hours and send gentle nudges.

> This README covers local setup only for now. The live URL, demo logins and iPhone steps are added when the app ships.

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
