# Research: timers, nightly reset and heartbeat on one always-on Fly machine

Research aid only. Accessed 2026-10-03. Nothing here is a decision. Items marked **Recommendation, not a decision** need the learner's approval.
Decided and not reopened: NestJS 12 on **one** always-on Fly machine (shared-cpu-1x, 512 MB, `auto_stop_machines = "off"`, `fly launch --ha=false`); `@nestjs/schedule` 12.x in-process; Prisma 7.10 + `prisma.config.ts` + `@prisma/adapter-pg`; one Supabase **Session pooler** `DATABASE_URL` (port 5432); Node 24 (`node:24-bookworm-slim`).
Versions checked on npm: `@nestjs/schedule` 12.0.2, which pins `cron` **4.4.0** (Luxon 3.7); `@prisma/adapter-pg` 7.10.0 → `pg` ^8.16 (8.23.1 current); `prisma` `latest` tag = **8.0.0-rc.19**, `prev` = 7.10.0.

## 1. Questions
1. `@Cron` with `timeZone` in NestJS 12: how the `cron` package behaves, overlapping runs, re-entry.
2. Fly deploys with one machine: strategy, old/new overlap (double-firing), downtime, graceful shutdown, restarts.
3. Idempotency if two instances ever run: advisory locks, conditional `UPDATE … RETURNING` claims, or a `system_state` check. Pooler caveats.
4. Supabase free-plan pausing: what counts as activity, and whether a daily write is enough.
5. Prisma 7 + adapter-pg pool size against the Supabase free Session-pooler limits.
6. `fly.toml` keys for one always-on machine.

## 2. Findings and options (within the decided stack)

### Q1. @nestjs/schedule 12 and cron 4.4.0
- `@Cron(expr, options)`. `CronOptions`: `name`, `timeZone` **or** `utcOffset` (mutually exclusive), `waitForCompletion`, `disabled`, `threshold` (default 250 ms), `initialDelay`, `unrefTimeout`. `ScheduleModule.forRoot({ cronJobs, intervals, timeouts })` can switch each kind off.
- **Overlap is the default.** In the cron 4.4.0 source, `fireOnTick` does not await an async `onTick` unless `waitForCompletion` is true. So a minute job that runs longer than 60 s **re-enters**. With `waitForCompletion: true`, ticks that fall during a run are **skipped, not queued**.
- **Errors:** Nest wraps every handler in try/catch and logs. A thrown error never kills the job or the process.
- **Missed ticks while the process is down are never replayed.** A timer that fires late still runs; `threshold` only covers a narrow edge case inside `start()`. Don't rely on it either way.
- **Time zone:** `timeZone: "America/Vancouver"` is resolved by Luxon. `0 3 * * *` is safe across DST: Vancouver springs forward 02:00→03:00 and falls back 02:00→01:00, so 03:00 happens exactly once each day. (A 02:xx time would be skipped once a year.) Jobs without `timeZone` use the container's zone, which is UTC on Fly unless `TZ` is set.
- **Shutdown:** the orchestrator's `beforeApplicationShutdown` calls `job.stop()` for each job **without awaiting** it, so an in-flight tick is not drained. Nest's order is `onModuleDestroy` → `beforeApplicationShutdown` → close connections → `onApplicationShutdown`.
- **Single-run guards in Nest:** the docs warn that calling `ScheduleModule.forRoot()` in more than one module registers every job once per import. They point multi-instance apps to `@nestjs/locks` + `@OnOneInstance()`.

| Option | Fit | Cost / risk |
|---|---|---|
| A. `waitForCompletion: true` + in-process `runExclusive` (one promise chain shared by all jobs) | Exact fit for one process. Stops self-overlap, and stops the 03:00 reset interleaving with the 03:00 minute tick | ~20 lines. Does nothing across processes, so it needs Q3's DB-level idempotency as a backstop |
| B. `@nestjs/locks` `@OnOneInstance()` | Built for multi-instance | **v0.0.1, published 2026-09-25.** Ships no store: you write a `LockStore` (the docs' recipes are Drizzle, TypeORM and Redis, not Prisma) plus a lease table. A new dependency for a one-machine app |
| C. DB idempotency only (Q3), no in-process guard | Correct, but re-entrant ticks still waste work and log noise | Lowest code |

### Q2. Fly deploys with one machine
- Strategies: `rolling` (default), `immediate`, `canary`, `bluegreen`.
  - **Rolling** updates the existing Machine **in place**: the Machines API says an update makes a running Machine reboot, and it keeps its ID. The old process gets `kill_signal`, then `SIGKILL` after `kill_timeout`, before the new image boots. **No overlap, so no double-firing.** It does mean **downtime** of roughly kill + boot + health check (tens of seconds). Fly community staff confirm a single machine can't deploy without downtime.
  - **Canary** boots an extra temporary Machine and waits for it to pass health checks. **Bluegreen** boots a second Machine alongside the old one. Either one boots a full NestJS app, so cron jobs, the boot catch-up reset and the heartbeat run **twice** during the deploy. Avoid both.
  - `release_command` runs in a **temporary Machine** with the new image and its `CMD` replaced. NestJS doesn't boot there, so it's safe for `prisma migrate deploy`.
- **What stops the machine even with autostop off:** deploys, `fly machine stop`, host migrations. Each is stop-then-start, with no overlap.
- **Restarts:** Machines from `fly deploy`/`fly launch` default to `on-failure`, which retries up to 10 times within 5 minutes and **only on non-zero exit**. An exit with code 0, or exhausted retries, leaves the Machine **stopped**. It then starts again only when an HTTP request arrives (`auto_start_machines`), and the timers are dead until then. `[[restart]] policy = "always"` never lets it stay stopped.
- **Signals:** the docs conflict on the default `kill_signal`. The configuration reference says **SIGINT**; the long-running-tasks blueprint says **SIGTERM**. Set it explicitly. `kill_timeout` defaults to 5 s, maximum 300 s, and is best-effort. The signal goes to the main process, so use an exec-form `CMD ["node","dist/main.js"]`, not a shell or `npm start` wrapper.
- NestJS: `app.enableShutdownHooks()` is needed for the destroy and shutdown hooks to run on a signal.

### Q3. Idempotency if two instances ever run
| Option | How | Pooler caveat | Verdict |
|---|---|---|---|
| A. Session advisory lock: `SELECT pg_try_advisory_lock(k)` via `$queryRaw` | Held by **one** pooled `pg` connection | Session mode pins one server connection per client, so the lock works, but Prisma's pool may run the next query and `pg_advisory_unlock` on **another** connection. The unlock then silently fails and the lock leaks until that connection closes. Transaction mode (6543) doesn't support session locks at all. The `@nestjs/locks` docs reject advisory locks for the same pool reason | Avoid |
| B. Transaction advisory lock: `pg_try_advisory_xact_lock(k)` as the first statement inside `prisma.$transaction(async tx => …)` | Same connection for the whole transaction. Released automatically at commit or rollback | Works in session mode | OK for the **reset** only. Wrong for jobs that send push inside, because it would hold a transaction open during network calls, and Prisma's interactive-transaction `timeout` defaults to 5 s |
| C. Conditional claim: `UPDATE … WHERE "demoNextNudgeAt" <= now() RETURNING id` (or `updateMany` and check `count === 1`) | Postgres re-checks the `WHERE` on the newest row version after a concurrent update commits, so only one claimer wins | None | **Best for bot nudges and bot acks** |
| D. `system_state` conditional upsert inside the reset transaction: `INSERT … ON CONFLICT (key) DO UPDATE SET value = now() WHERE system_state.value < $latest3am RETURNING key` | The reset proceeds only if a row comes back. A second runner blocks on the row lock, then sees the new value and gets 0 rows | None | **Best for the reset**, since it doubles as the catch-up test. If the reset is killed midway it rolls back and is retried on the next boot |

- **Bot nudges:** claim first (advance `demoNextNudgeAt`), then create and push. That is *at-most-once*: a crash in between drops one nudge, and the next comes within 30–120 min. Send-then-claim is at-least-once, which risks double pushes. With only 3 demo users, a per-user `updateMany({where:{id, demoNextNudgeAt:{lte: now}}})` loop is enough. A single `$queryRaw` with `now() + make_interval(mins => 30 + floor(random()*91)::int)` gives each row its own random interval.
- **Bot acks:** `updateMany({ where: { acknowledgedAt: null, createdAt: { lte: now-60s }, recipient: { isBot: true } } })` is already idempotent.
- **Heartbeat:** an upsert is already idempotent.
- **Arming in `GET /me`:** use a conditional `updateMany({ where: { id, demoNextNudgeAt: null } })` so concurrent opens don't overwrite each other.

### Q4. Supabase free-plan pausing
- Supabase evaluates activity over **7 days**. Its own wording is that a few user requests to the database each day "is enough to keep the project from being paused". It doesn't say whether reads, writes or pooler traffic count differently. A paused project can be restored within **1 year**.
- While the Fly machine is up, the minute job (~1,440+ queries a day) and the `/health` `SELECT 1` (every 15 s ≈ 5,760 a day) far exceed "a few requests". The daily heartbeat write is **belt-and-braces**: harmless, and useful as a visible "scheduler alive" timestamp.
- **The real pause risk is the Fly machine being stopped for 7+ days** (crash loop under `on-failure`, an exit with code 0, a manual stop). When the machine is down the heartbeat doesn't run either. So the restart policy matters more than the heartbeat.

### Q5. Pool sizing (Prisma 7 + adapter-pg → Supavisor session mode)
- Prisma 7's `pg` adapter defaults: `max` **10**, `connectionTimeoutMillis` **0** (wait forever), `idleTimeoutMillis` **10 s**, no lifetime limit. `new PrismaPg(poolConfig | pg.Pool | string, options?)` takes a full `pg.PoolConfig`.
- Supabase Nano (free): 60 max DB connections, 200 max pooler clients. **In session mode each client holds one Postgres connection, and clients are capped at the dashboard "Pool Size" per role+database** (the docs' example uses 15). Over the cap, clients queue for up to a minute.
- Our load: 3 judges, a few concurrent requests, plus jobs. One machine needs 2–5 connections. Leave headroom under the same `prisma` role for `prisma migrate deploy`, `psql` and seed, and for sessions possibly left stale after a `SIGKILL`. That last point is an inference, not documented.
- With the default `idleTimeoutMillis` of 10 s and a 15 s check interval, idle connections drop between ticks. Each tick then opens a new TLS session to the pooler and a new Postgres backend: harmless, but slower. A longer idle timeout keeps one connection warm.
- **SSL:** `pg` 8.x treats `sslmode=require` as `verify-full`, and when the URL contains `sslmode` it **ignores** the `ssl` object. Supabase signs with its own root CA, so this is a known cause of `SELF_SIGNED_CERT_IN_CHAIN`. Options: pin the Supabase root CA (`ssl: { ca }`, with no `sslmode` in the URL), or `sslmode=no-verify` (encrypted but not verified).

### Q6. fly.toml for one always-on machine
- `[[vm]]`: `size = "shared-cpu-1x"`, `memory = "512mb"` (unit strings or integer MB), plus optional `cpu_kind` and `cpus`. Optional top-level `swap_size_mb` guards against brief OOM spikes.
- `[http_service]`: `internal_port`, `force_https`, `auto_stop_machines` (`"off"`/`"stop"`/`"suspend"`; **`fly launch` writes `"stop"`**), `auto_start_machines` (default true), `min_machines_running` (ignored when `"off"`), `processes`.
- `[[http_service.checks]]`: `grace_period`, `interval`, `timeout`, `method`, `path`. These run over the private network and don't follow redirects; `force_https` doesn't affect them. **Service checks gate routing**: when the only machine fails, connections block or return 503. Top-level `[checks]` are for observability only.
- Top-level `kill_signal` and `kill_timeout`. `[deploy] strategy`, `release_command` and `wait_timeout` (default 5 min). `[[restart]] policy` and `retries`. Fly says `fly config validate` accepts unknown keys silently, so use `--strict`.

## 3. Concrete gotchas
1. **Overlap by default:** without `waitForCompletion`, a slow minute tick (for example a push timing out) re-enters.
2. **Silent stall:** *with* `waitForCompletion`, one `await` that never settles skips **every** later tick. Defaults that can hang: `pg` `connectionTimeoutMillis: 0`, and web-push has no socket `timeout` unless one is set.
3. **Prisma disconnect order:** the common recipe puts `$disconnect()` in `onModuleDestroy`, which runs **before** `@nestjs/schedule` stops jobs in `beforeApplicationShutdown`. A tick can start after the pool has ended. Neither layer drains an in-flight tick for you.
4. **Ways to double-fire despite "one machine":** `--strategy canary`/`bluegreen`; the default 2 machines on first launch; `fly scale count 2`/`fly machine clone`; an **old Fly app still running with the same `DATABASE_URL`**; a local backend pointed at the production URL; a Nest standalone script (seed or reset via `NestFactory.createApplicationContext(AppModule)`) that imports `ScheduleModule`; `forRoot()` imported in two modules.
5. **On-failure restart gap:** an exit with code 0, or 10 crashes in 5 minutes, leaves the machine stopped until an HTTP request arrives. Timers and heartbeat stop, and Supabase pauses after 7 days.
6. **`kill_signal` default unclear** (SIGINT vs SIGTERM in Fly's own docs), and `kill_timeout` 5 s is short. A shell or `npm start` wrapper as the main process can swallow the signal.
7. **Missed 03:00:** a deploy or crash around 03:00, or a tick lost while the process is up, skips that day's reset. Boot-only catch-up misses the second case.
8. **Bot cooldown:** if bot nudges go through the *full* `POST /nudges` pipeline, the 5-minute **sender cooldown** rejects a bot picked for two judges within 5 minutes. With claim-then-send, that nudge is lost until the next 30–120 min slot.
9. **Reset transaction time:** Prisma's interactive-transaction `timeout` defaults to 5 s. A reset over the pooler with a cold connection can exceed it and roll back.
10. **Health check with DB:** `/health` does `SELECT 1` through the pooler, so a DB blip or a queued pool makes the only machine unroutable (503). A slow boot (catch-up reset before `listen`) can outlast `grace_period`.
11. **`npx prisma` in the runtime image:** if the `prisma@7` CLI isn't installed in the production image, `npx prisma migrate deploy` fetches from the registry, where `latest` is **8.0.0-rc.19**. Without a TTY, the npx install prompt can also stall the command.
12. **SSL:** `?sslmode=require` with `pg` 8.x plus Supabase's CA leads to `SELF_SIGNED_CERT_IN_CHAIN`, and an `ssl` object is ignored if the URL has `sslmode`.

## 4. Recommended defaults (**Recommendation, not a decision**)
- **Jobs:** `ScheduleModule.forRoot()` once, in `AppModule`. One `SchedulerService` holds all three `@Cron`s, each named, with `waitForCompletion: true`:
  - `"* * * * *"` (minute)
  - `"0 3 * * *"` with `timeZone: "America/Vancouver"` (reset)
  - `"0 12 * * *"` with `timeZone: "America/Vancouver"` (heartbeat). Make the zone explicit; the hour doesn't matter.

  All handlers go through one in-process `runExclusive()`. A `shuttingDown` flag set in `onModuleDestroy` makes ticks return immediately, then the service awaits the in-flight promise.
- **Catch-up:** check "reset overdue?" (latest 03:00 Vancouver vs `lastDemoResetAt`) **after `app.listen()`** on boot **and** at the start of every minute tick. One cheap read covers deploys at 03:00 and lost ticks alike. The 03:00 cron stays as the primary trigger.
- **Idempotency:** Q3 options C (nudges and acks), D (reset, inside one `$transaction` with `timeout: 20_000`), and an upsert (heartbeat). No session advisory locks. Option B (`pg_try_advisory_xact_lock`) is an optional extra inside the reset. No `@nestjs/locks`.
- **Timeouts on every await in a tick:** web-push `{ TTL: 3600, timeout: 10_000 }`; `pg` `connectionTimeoutMillis: 10_000` and `statement_timeout`/`query_timeout` ≈ 15 s.
- **Bot sends** reuse `NudgesService`'s create + push step but **skip the sender cooldown** (or choose a bot that isn't in cooldown).
- **Pool:** `new PrismaPg({ connectionString, max: 5, idleTimeoutMillis: 60_000, connectionTimeoutMillis: 10_000, keepAlive: true, ssl: { ca: <Supabase root CA> } })`, with no `sslmode` in `DATABASE_URL`. The CA is a public certificate, not a secret; verify where the dashboard offers it. Keep the dashboard Pool Size at its default (≥ 15).
- **Shutdown:** `app.enableShutdownHooks()`; Prisma `$disconnect()` in `onApplicationShutdown`; Dockerfile `CMD ["node","dist/main.js"]` in exec form.
- **fly.toml:**
  - `kill_signal = "SIGTERM"`, `kill_timeout = 30`
  - `[deploy] strategy = "rolling"`, plus optionally `release_command = "npx prisma migrate deploy"` with `prisma@7` in the runtime image's dependencies
  - `[[restart]] policy = "always"`
  - `[http_service]`: `internal_port = 3000`, `force_https = true`, `auto_stop_machines = "off"`, `auto_start_machines = true`, `processes = ["app"]`
  - `[[http_service.checks]]`: `grace_period = "30s"`, `interval = "15s"`, `timeout = "5s"`, `method = "GET"`, `path = "/health"`
  - `[[vm]]`: `size = "shared-cpu-1x"`, `memory = "512mb"`
  - optionally `swap_size_mb = 512`

  Then run `fly config validate --strict`, and after the first deploy, `fly scale show` and `fly machine status <id>` to confirm the restart policy.
- **Kill switch:** `ScheduleModule.forRoot({ cronJobs: process.env.SCHEDULER_ENABLED !== "false" })`, so a local or ad-hoc process pointed at production can opt out.

## 5. Code and config pointers (names only)
- `@nestjs/schedule`: `Cron`, `CronExpression.EVERY_MINUTE`, `CronOptions{name,timeZone,waitForCompletion,disabled,initialDelay}`, `SchedulerRegistry.getCronJob(name)`, `ScheduleModule.forRoot({cronJobs})`.
- NestJS: `enableShutdownHooks()`; `OnModuleDestroy`, `BeforeApplicationShutdown`, `OnApplicationShutdown`.
- Prisma 7: `new PrismaPg(pg.PoolConfig)`; `$transaction(fn, { timeout, maxWait })`; `updateMany` → `{count}`; `$queryRaw` tagged template; `PrismaClient({ transactionOptions })`.
- Postgres: `pg_try_advisory_xact_lock(bigint)`; `INSERT … ON CONFLICT … DO UPDATE … WHERE … RETURNING`; `make_interval(mins => …)`.
- web-push: `sendNotification(sub, payload, { TTL, timeout })`.
- Fly: `kill_signal`, `kill_timeout`, `[deploy] strategy|release_command|wait_timeout`, `[[restart]] policy|retries`, `[http_service] …`, `[[http_service.checks]] …`, `[[vm]] size|memory`, `swap_size_mb`; CLI `fly config validate --strict`, `fly scale show`, `fly deploy --ha=false`.

## 6. Sources (all accessed 2026-10-03)
- NestJS task scheduling: https://docs.nestjs.com/techniques/task-scheduling · lifecycle: https://docs.nestjs.com/fundamentals/lifecycle-events · locks: https://docs.nestjs.com/reliability/locks
- `@nestjs/schedule` 12.0.2 package source (`dist/scheduler.orchestrator.js`, `scheduler.registry.js`, `decorators/cron.decorator.d.ts`), npm registry
- cron 4.4.0: https://github.com/kelektiv/node-cron (README, `dist/job.js`)
- Fly: https://docs.fly.io/reference/configuration · https://docs.fly.io/launch/deploy · https://docs.fly.io/blueprints/seamless-deployments/ · https://docs.fly.io/blueprints/long-running-tasks · https://docs.fly.io/blueprints/task-scheduling/ · https://docs.fly.io/machines/api/machines-resource/ · https://docs.fly.io/machines/guides-examples/machine-restart-policy/ · https://docs.fly.io/launch/autostop-autostart/ · https://docs.fly.io/apps/app-availability · https://community.fly.io/t/application-downtime-while-deploying/18808
- Supabase: https://supabase.com/docs/guides/platform/free-project-pausing · https://supabase.com/docs/guides/platform/compute-and-disk · https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI · https://supabase.com/docs/guides/database/prisma · https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting · https://supabase.com/docs/guides/self-hosting/accessing-postgres (session vs transaction features) · https://supabase.com/docs/guides/database/psql (root certificate)
- Prisma 7 pool defaults: https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool · client reference (`transactionOptions`): https://www.prisma.io/docs/orm/v7/reference/prisma-client-reference · `@prisma/adapter-pg` 7.10.0 `dist/index.d.ts`
- Postgres 17: https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS · https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED
- web-push `timeout`: https://github.com/web-push-libs/web-push (README) · npx: https://docs.npmjs.com/cli/v11/commands/npx
- SSL issue reports (community, not official): https://community.fly.io/t/error-self-signed-certificate-in-certificate-chain-when-using-supabase-connection-string/22977 · https://github.com/prisma/prisma/issues/29060

## 7. Spec gaps or contradictions (`devpost/spec.md`)
1. **"Backend: Scheduler"**: no overlap guard (`waitForCompletion` or in-process exclusion), no shutdown drain, and the heartbeat cron has no `timeZone` (it runs at 12:00 UTC). Nothing stops the reset and the minute tick interleaving at 03:00.
2. **"Backend: Demo module" (bot nudges)**: claim order and atomicity aren't specified (read due users → push → update allows double sends). "Through `NudgesService` (same pipeline)" hits the **5-minute sender cooldown** in "Backend: Nudges module (the kernel)" step 2 when one bot is picked twice. The nightly reset is "one transaction", but it gives no transaction timeout (Prisma default 5 s), and `lastDemoResetAt` is recorded rather than used as a **conditional guard**. Catch-up is "on boot" only.
3. **"Backend: Me"**: arming is read-then-write; a conditional update avoids a race between concurrent opens.
4. **"Backend: Health"**: doesn't say what HTTP status `db: false` returns. "Important Failure Modes" expects Fly's check to flag it, which needs a non-2xx status. The spec also doesn't mention that a failing service check makes the single machine unroutable.
5. **"Where It Runs and How Someone Tries It > Live"**:
   - The `fly.toml` list lacks `kill_signal`/`kill_timeout`, `[deploy] strategy`, `[[restart]] policy`, and the check timings.
   - It doesn't warn that `fly launch` writes `auto_stop_machines = "stop"`.
   - "One machine also guarantees each timer runs once" is **overstated** (see gotcha 4).
   - "A new app means a new machine" names only the bill risk. If the old app still holds the production `DATABASE_URL`, it is a **double-firing** risk too.
   - `fly ssh console -C "npx prisma migrate deploy"` needs `prisma@7` inside the runtime image (gotcha 11).
6. **"External Services and Dependencies > Supabase (Postgres only)"**:
   - "The daily heartbeat write prevents that" misplaces the cause: regular traffic already keeps the project active, and the real risk is the machine being stopped.
   - No pool `max`, no pooler Pool Size cap, and no SSL/CA handling (gotcha 12).
   - The "Important Failure Modes" DB entry should list SSL as a cause too.
7. **"External Services and Dependencies > Fly.io (backend hosting)"**: the doc links use `fly.io/docs/...`, which now 301-redirects to `docs.fly.io`. They still work.
8. **"Important Failure Modes"**: missing a stalled scheduler (a hung await), the machine left stopped under `on-failure`, and double-running instances.
9. **"Decisions and Open Issues > Verification results"**: no entry for scheduler or shutdown behaviour. The kill-signal discrepancy and the `fly.toml` validation are worth adding as "Verify early".
10. **PRD vs spec (for the learner to reconcile, not reopen):** `prd.md > Demo House` says bot nudges "never stop" and the first comes "after notification setup". Spec decision 4 pauses bots after 03:00 until `GET /me`, and `GET /me` arms on any app open, before notification setup.
