# Research: our own sign-in in NestJS 12 (Hushmate)

> **Research aid only. Nothing here is a decision.** It supports `devpost/spec.md > Backend: Auth module`.
> **Fixed inputs (not reopened):** own sign-in inside the NestJS 12 API; argon2id via `argon2` 0.45; `@nestjs/jwt` 12 issuing a JWT `{sub: userId}`, valid 30 days, no refresh; token in localStorage sent as `Authorization: Bearer`; `@nestjs/throttler` 6 on sign-in; no endpoints to change name, email or password or to delete accounts; DemoGuard; Node 24 LTS on `node:24-bookworm-slim`; Prisma 7.10 + Postgres.
> **Versions checked on npm on 2026-10-03:** argon2 0.45.1, @nestjs/core 12.1.2 (`"type": "module"`), @nestjs/jwt 12.0.2 (ESM, wraps jsonwebtoken 9.0.3), @nestjs/throttler 6.7.1 (peer `^12`), @nestjs/passport 12.0.0, passport-jwt 4.0.1, class-validator 0.15.1, jest 30.5.2, supertest 7.3.1.

## 1. Questions
1. argon2 on `node:24-bookworm-slim`: does it use prebuilt binaries, or does the image need build tools? Which argon2id parameters suit a 512 MB shared-CPU machine?
2. Guard pattern: a global JWT guard with `@Public()`, or per-controller guards? `@nestjs/jwt` directly, or Passport? How should the user be attached to the request, and what shape should the DemoGuard take?
3. Throttler 6: how do we limit only sign-in (5/min per IP), and how do we get the real client IP behind Fly's proxy?
4. JWT details: the secret, `expiresIn: '30d'`, per-request verification, the payload, and how the frontend handles a 401.
5. Email normalization and uniqueness (service lower-casing, citext, or `lower(email)` index), plus DTO validation.
6. localStorage token risk and proportionate mitigations (CSP on Vercel, no third-party scripts). CORS for the Vercel origins, including previews.
7. e2e testing of auth with Jest + Supertest in NestJS 12.

## 2. Options and trade-offs (within the decided stack)

### Q1. argon2 install and parameters
- **Install:** the `argon2@0.45.1` npm tarball ships N-API prebuilds: `prebuilds/linux-x64/argon2.glibc.node`, `prebuilds/linux-arm64/argon2.armv8.glibc.node`, plus musl variants. Its install script is `node-gyp-build`, which compiles only when no prebuild matches. So **bookworm-slim needs no `python3`/`make`/`g++`**. Fly's amd64 remote builder and an arm64 OrbStack build on Apple Silicon both find a prebuild. Build tools matter only if someone passes `--build-from-source`.
- **Parameters.** OWASP lists five equal-strength argon2id settings, all with p=1. The table compares them with the library default:

| Setting (m / t / p) | Peak RAM if 4 hashes overlap* | Fit for `shared-cpu-1x` 512 MB |
|---|---|---|
| node-argon2 default: 64 MiB / 3 / 4 | ~256 MiB | Poor. Half the RAM, and p=4 gains nothing on one shared vCPU |
| OWASP: 46 MiB / 1 / 1 | ~184 MiB | Workable but tight beside NestJS + Prisma |
| **OWASP: 19 MiB / 2 / 1** (`memoryCost: 19456`) | ~76 MiB | Good balance of RAM and CPU |
| OWASP: 12 MiB / 3, 9 MiB / 4, 7 MiB / 5 (all p=1) | < 50 MiB | Less RAM, more CPU per hash. CPU is the scarcer resource here |

\*Hashes run on the libuv threadpool (default `UV_THREADPOOL_SIZE=4`), so at most 4 run at once. Argon2 memory is native, outside the V8 heap, but still counts toward the machine's RSS.
- **CPU:** a Fly shared vCPU's baseline is 6.25% (5 ms per 80 ms period), with a burst balance of up to 500 s. Once the balance runs out, a hash runs about 16 times slower. OWASP's target is under 1 s per hash, so measure on the real machine.

### Q2. Guard design
| Option | For | Against |
|---|---|---|
| **A. Global guard (`APP_GUARD`) + `@Public()`** (NestJS docs pattern) | Secure by default: a missing `@Public()` shows up as a loud 401 in tests | `@Public()` must go on `/auth/*`, `/health`, `/push/vapid-public-key` |
| B. `@UseGuards(JwtGuard)` per controller | Explicit | A forgotten decorator silently exposes a route |

| JWT mechanism | For | Against |
|---|---|---|
| **`JwtService.verifyAsync` in a hand-written `CanActivate`** (NestJS "Authentication" chapter) | One dependency, about 30 lines, full control of the 401 | Header parsing is ours |
| Passport (`@nestjs/passport` 12 + `passport-jwt` 4.0.1; NestJS "Passport" recipe) | Strategy pattern that makes adding OAuth easy later | 3–4 more deps, more indirection. Third-party sign-in was rejected, so that extensibility goes unused |

- **User on the request:** (i) attach the payload only (`{id: sub}`), or (ii) have the guard load `{id, isDemo, isBot, activeHouseId}` by primary key on every request. Option (ii) costs one indexed query per request. In return it always has a fresh `isDemo`, and a token whose user no longer exists returns 401.
- **DemoGuard:** (a) `@UseGuards(DemoGuard)` on the blocked handlers. It reads `request.user.isDemo` and throws `ForbiddenException`. Nest runs global guards first, then controller guards, then route guards, so the JWT guard has already run. (b) A `@NoDemo()` metadata decorator that the global guard checks via `Reflector`: one guard, but it mixes two concerns. (c) Checks inside services, which are easy to forget.

### Q3. Throttling sign-in, and the client IP on Fly
| Scope | For | Against |
|---|---|---|
| **A. `@UseGuards(ThrottlerGuard)` on `AuthController` only** + `forRoot({throttlers:[{ttl: seconds(60), limit: 5}]})` | Nothing else can return 429. Summary's 30 s polling and the focus re-checks are untouched | No general flood protection |
| B. Global `APP_GUARD` with a generous default + `@Throttle` override on sign-in | Some protection everywhere | The default must be sized against polling and shared NAT, and the UI needs 429 handling everywhere |

The storage key is `Class-handler-throttler-tracker`, so **each route gets its own counter**: sign-up and sign-in each get 5/min per IP. Storage is in memory, which is fine on one machine; a deploy resets the counters.

| Client-IP source | For | Against |
|---|---|---|
| **`Fly-Client-IP` header in `getTracker`, falling back to `req.ip`** | Fly's docs recommend it when nothing sits in front of Fly. The proxy sets it | Becomes a CDN's IP if one is ever added. In local dev, the client can send it (harmless) |
| `app.set('trust proxy', n)` + `req.ip` | Standard Express | Fly documents the **rightmost** `X-Forwarded-For` entry as *your app's own IP*. So `trust proxy = 1` probably maps every client to one bucket; the correct `n` is unverified |
| `req.ips[0]` (the throttler README example) | None | The leftmost XFF entry is supplied by the client, so it's trivially spoofed and defeats the limit |

### Q4. JWT details
- **Secret:** HS256 (the default) needs a key of at least 256 bits (RFC 7518 §3.2). Generate one with `openssl rand -base64 48`. Use different values locally and on Fly, never log them, and fail at boot if the secret is missing or shorter than 32 bytes.
- **Expiry:** `signOptions.expiresIn` is typed `StringValue | number`. A plain `string` from env fails the type check, so keep the literal `'30d'` (or `60*60*24*30`).
- **Payload:** `{sub: user.id}` only (`iat`/`exp` are added automatically). Leave `isDemo`, email and name out: they'd be stale for 30 days, and anyone holding the token can read them, because a JWT is signed, not encrypted.
- **Verify on every request:** `verifyAsync` with `algorithms: ['HS256']` pinned. Map `TokenExpiredError`, `JsonWebTokenError` and `NotBeforeError` all to `UnauthorizedException`.
- **Revocation:** none by design. The kill switch is rotating `JWT_SECRET`, which signs everyone out.
- **Frontend 401 handling, two places for it:** (a) the central `api/client.ts` fetch wrapper: on a 401 from any non-`/auth` route, clear the token, call `queryClient.clear()` and navigate to `/signin`; or (b) TanStack `QueryCache`/`MutationCache` `onError`. Either way, add a `retry` rule that skips 401/403. A 401 from `/auth/signin` means wrong credentials, not an expired session, so show the form error there. Optionally decode `exp` on the client to skip a flash of the app before the first 401.

### Q5. Email uniqueness and validation
| Option | For | Against |
|---|---|---|
| **A. Normalize in the DTO (`trim` + `toLowerCase`) + `email String @unique`** (the spec's design) | Prisma-native; `findUnique({where:{email}})` works | Every write path (seed, scripts) must normalize. Optional backstop: `CHECK (email = lower(email))` in a hand-edited migration |
| B. `citext` (`@db.Citext`) | The database enforces case-insensitivity | The `postgresqlExtensions` preview feature is deprecated, so `CREATE EXTENSION citext` goes in a `--create-only` migration. Supabase puts extensions in its `extensions` schema, so the `prisma` user's `search_path` must resolve the type |
| C. Unique index on `lower(email)` | The database enforces it | Can't be expressed in `schema.prisma`, needs hand-written SQL, and `findUnique` can't target it |

DTOs: email `@IsEmail() @MaxLength(254)`; password `@IsString() @MinLength(8) @MaxLength(128)`, never trimmed or lower-cased (argon2 has no 72-byte cap like bcrypt; the max only bounds the input); name `@IsString()`, trimmed, length 1–40. Sign-in can validate loosely (`@IsString()`) and answer every failure with the same 401.

### Q6. The localStorage risk, CSP and CORS
- **Risk:** any XSS can read the token. OWASP's HTML5 cheat sheet advises against session identifiers in local storage. With a 30-day token and no revocation, a stolen token stays useful for a long time.
- **Proportionate mitigations for a PoC:** no third-party scripts (fonts are already self-hosted; skip Vercel Analytics and Speed Insights). User text (names, house names, heads-ups) is rendered only as React text, never with `dangerouslySetInnerHTML`. A CSP goes in `vercel.json` `headers`. Secret rotation is the kill switch.
- **Draft CSP** (recommendation): `default-src 'self'; script-src 'self'; connect-src 'self' https://<fly-app>.fly.dev; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`. Also send `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`. `'unsafe-inline'` for styles is likely needed because Radix Dialog's scroll lock injects a `<style>` tag; check the console.

| CORS option | For | Against |
|---|---|---|
| **Exact origins from `FRONTEND_ORIGIN`** (comma list: production + `http://localhost:5173`) | Tight and simple | Preview deployments can't call the API |
| + anchored RegExp for previews: `^https://<project>-(git-[a-z0-9-]+\|[a-z0-9]{9})-<scope-slug>\.vercel\.app$` | Previews work | Must be anchored and include your scope slug. A loose pattern can be matched by someone else's project name |

The stakes are low. With bearer tokens and no cookies, CORS isn't what protects credentials: a foreign origin has no token to send. Use `credentials: false`. Previews can also sit behind Vercel's Standard Protection, which covers every URL except production domains.

### Q7. Testing auth (Jest + Supertest)
- **Scaffold:** in v12, `nest new` asks for a module system. ESM (the default) gives Vitest; **CommonJS gives Jest**. Without a terminal it picks ESM. Jest can `require()` the ESM-only v12 packages only on **Node ≥ 24.9** (the image has 24.21; host Node 26 is fine). Pass `--skip-git`, since `app/` is already a repo, and `--no-observe`.
- **App under test:** `Test.createTestingModule({imports:[AppModule]})` → `createNestApplication()` → the same setup `main.ts` uses → `app.init()` → `request(app.getHttpServer())`. Anything set only in `main.ts` (`useGlobalPipes`, CORS) **isn't** applied in tests.
- **Database:** a separate test database on the compose Postgres. Run `prisma migrate reset --force` once, truncate tables between files, and use `--runInBand`.
- **Cases:**
  - sign-up returns `{token, user}` without `passwordHash`
  - the same email in different case returns 409
  - a 7-character password returns 400
  - a wrong password and an unknown email return identical 401 bodies
  - a bot can't sign in
  - the 6th sign-in within 60 s returns 429. Give it its own app instance, because storage is per instance
  - no token, a garbage token, a wrong-secret token and an expired token each return 401
  - a demo user gets 403 on create, both join routes, activate and dismiss
  - a demo user can still `GET /me` and add quiet times
- **Expired token:** use `new JwtService({secret})` with no `signOptions` and a payload carrying an explicit past `exp`. The module's `expiresIn` plus a payload `exp` throws.

## 3. Gotchas
1. **node-argon2's defaults (64 MiB, p=4) are sized for bigger machines.** Pass the parameters explicitly. `verify` reads the parameters from the stored hash, so tuning later is safe; `needsRehash` tells you when to re-hash.
2. **IP spoofing and bucket collapse:** the README's `req.ips[0]` pattern is spoofable, and `trust proxy = 1` on Fly likely resolves to the app's own IP. Use `Fly-Client-IP`, and check it once on the deployed app.
3. **Demo passwords are public**, so never add per-account lockout: anyone could lock the judges out. Throttle per IP only.
4. `@Transform` lower-cases the email for validation, but the handler only receives the transformed DTO with `ValidationPipe({transform: true})`.
5. Register `ValidationPipe` as `APP_PIPE` (or use a shared `configureApp(app)`), or the e2e tests run without validation.
6. **Demo user IDs must survive the nightly reset.** Tokens carry `sub: userId`. If the reset or seed re-creates the demo users, every judge gets a 401 at 3 AM, and their push subscriptions are orphaned. Upsert by email.
7. TanStack Query retries failed queries 3 times by default, so an expired token delays the redirect unless `retry` skips 401.
8. After a token expires, `DELETE /push/subscriptions` can't succeed. Also call `PushSubscription.unsubscribe()` in the browser; the push service then returns 410, and the backend already deletes subscriptions on 410.
9. Vite inlines assets under 4 KiB as `data:` URIs, so the CSP needs `data:` for images and fonts, or set `build.assetsInlineLimit: 0`.
10. On previews, the CSP blocks the Vercel Toolbar unless `https://vercel.live` is allowed. This is harmless.
11. To show a "try again in N s" message on 429, add `exposedHeaders: ['Retry-After']` to CORS. The throttler sets the header only on blocked responses.
12. Two concurrent sign-ups with one email race past a "find first" check. Rely on the unique index and map Prisma `P2002` to 409, not 500.
13. Validation errors come back as `message: string[]` plus `error`, but the contract promises `{statusCode, message}`. The frontend must handle both.
14. User enumeration: an unknown email answers faster than a wrong password unless you `verify` against a dummy hash computed at boot. Sign-up's 409 reveals registered emails anyway, which is acceptable for a PoC.
15. Never log request bodies or the `Authorization` header (Nest's default logger doesn't, but custom interceptors might).

## 4. Recommended defaults (recommendation, not a decision)
- **argon2id** `{type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1}`. No pepper. Install with plain `npm ci` (no build tools). Time one hash on Fly early (target well under 1 s).
- **Guards:** a global hand-written `AuthGuard` (`@nestjs/jwt`, no Passport) with `@Public()`. It loads the user row by `sub`, rejects missing users and `isBot`, and sets `request.user = {id, isDemo, activeHouseId}`. Add a `@CurrentUser()` param decorator. Use `DemoGuard` via `@UseGuards` on create, both join routes, activate and dismiss.
- **Throttling:** `ThrottlerGuard` on `AuthController` only, at 5/min per IP for **both** sign-up and sign-in. Use `getTracker` = `Fly-Client-IP` ?? `req.ip` and a friendly `errorMessage`.
- **JWT:** HS256, a 48-byte random secret, `expiresIn: '30d'`, `algorithms: ['HS256']`, payload `{sub}` only.
- **Email:** option A (DTO `trim().toLowerCase()` + `@unique`), with `P2002` mapped to 409.
- **Frontend:** a central 401 handler (clear the token and query cache, browser-side push unsubscribe, go to `/signin`). Keep `return-to` for `/join/:inviteToken`. Add the CSP plus `nosniff` in `vercel.json`.
- **CORS:** `FRONTEND_ORIGIN` as a comma list of exact origins; add a preview RegExp only if previews are actually used.
- **Tests:** scaffold as CommonJS (Jest); one e2e file per concern (auth, guard, demo, throttle).

## 5. Code-level pointers (no implementation)
- **argon2:** `argon2.hash(pw, {type: argon2.argon2id, memoryCost, timeCost, parallelism})`, `argon2.verify(hash, pw)` (returns false, doesn't throw, on a mismatch), `argon2.needsRehash(hash, opts)`.
- **@nestjs/jwt:**
  - `JwtModule.registerAsync({global: true, useFactory: () => ({secret, signOptions: {expiresIn: '30d'}, verifyOptions: {algorithms: ['HS256']}})})`
  - `jwtService.signAsync({sub})`, `verifyAsync<{sub: string}>(token)`
  - errors `TokenExpiredError`, `JsonWebTokenError`, `NotBeforeError` (exported from `@nestjs/jwt`)
- **Nest core:**
  - `CanActivate`, `ctx.switchToHttp().getRequest()`
  - `Reflector.getAllAndOverride(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])`
  - `SetMetadata`, `{provide: APP_GUARD, useClass: AuthGuard}`
  - `createParamDecorator`
  - `UnauthorizedException`, `ForbiddenException`, `ConflictException`
- **Throttler:**
  - `ThrottlerModule.forRoot({throttlers: [{ttl: seconds(60), limit: 5}], getTracker, errorMessage})`
  - `@UseGuards(ThrottlerGuard)`, `@Throttle({default: {limit, ttl}})`, `@SkipThrottle()`
- **Validation:**
  - `{provide: APP_PIPE, useValue: new ValidationPipe({whitelist: true, forbidNonWhitelisted: true, transform: true})}`
  - `@Transform(({value}) => typeof value === 'string' ? value.trim().toLowerCase() : value)`
- **CORS:** `app.enableCors({origin: (string|RegExp)[], methods: ['GET','POST','PATCH','DELETE'], allowedHeaders: ['Authorization','Content-Type'], exposedHeaders: ['Retry-After'], maxAge: 600, credentials: false})`.
- **Prisma:** catch `Prisma.PrismaClientKnownRequestError` with `code === 'P2002'`. Make `passwordHash String?` for bots and treat `null` as a failed sign-in.
- **Frontend:**
  - `new QueryClient({queryCache: new QueryCache({onError}), mutationCache: new MutationCache({onError}), defaultOptions: {queries: {retry}}})`, `queryClient.clear()`
  - `navigator.serviceWorker.ready` → `pushManager.getSubscription()` → `.unsubscribe()`
  - React Router `<Navigate to="/signin" state={{from: location}} />`
- **Vercel:** in `vercel.json`, beside `rewrites`: `"headers": [{"source": "/(.*)", "headers": [{"key": "Content-Security-Policy", "value": "…"}]}]`.
- **Tests:** `Test.createTestingModule`, `.overrideGuard()`/`.overrideProvider()`, `app.getHttpServer()`, `request(...).post('/auth/signin').set('Fly-Client-IP', '203.0.113.9')`, `afterAll(() => app.close())`.

## 6. Spec gaps or contradictions
1. **`External Services and Dependencies > The backend API contract`:**
   - The shape of `user` in `{token, user}` isn't defined. Suggest the `GET /me` shape, never `passwordHash`.
   - No error rows: sign-up 400/409; sign-in 400/401/429; every guarded route 401; demo-blocked routes 403.
   - `{statusCode, message}` doesn't match ValidationPipe's `message: string[]`.
2. **`Backend: Auth module`:**
   - Sign-up isn't throttled, though it costs the same argon2 CPU and allows mass account creation.
   - argon2 parameters aren't stated, and the library default (64 MiB, p=4) is heavy for 512 MB.
   - The client-IP source behind Fly isn't specified.
   - Email normalization says "lower-cased" but not trimmed.
   - No password maximum or name length.
   - No same-401 / dummy-verify policy against user enumeration.
   - Sign-in behaviour for bots ("no usable password" in `Data Model`) is unspecified. Suggest a nullable `passwordHash` plus rejecting `isBot`.
3. **`Where It Runs and How Someone Tries It > Locally`:** "fill in JWT_SECRET" gives no length or generation command (`openssl rand -base64 48`, at least 32 bytes).
4. **`Frontend: App shell and routing`:**
   - `RequireAuth` only checks that a token exists; there's no 401 handling for an expired or invalid token.
   - The backend guards everything except `/auth/*`, `/health` and the VAPID key, so a signed-out invitee hitting `/join/:inviteToken` is redirected to `/` and **loses the invite**. A return-to is needed.
   - How sign-in "lands where it left off" (PRD `Accounts and Sign-In`) isn't specified. For example: no memberships → onboarding, otherwise return-to or `/schedule`.
5. **`Frontend: Profile`** (Sign out):
   - Also needs browser-side `PushSubscription.unsubscribe()`, which still works when the token has expired. Without it, demo nudges keep reaching the device, against the PRD's "signing out stops them".
   - Also needs `queryClient.clear()`, so the next account on the same phone doesn't see cached data.
6. **`Backend: Houses module`** (Demo guard):
   - "join" should explicitly cover both `POST /houses/:id/join` and `POST /invites/:token/join`.
   - Strangers can still *request* to join the demo house by ID or invite link.
   - **`Backend: Demo module`** doesn't say who owns the demo house (`houses.ownerId` is required). If a judge account owns it, judges could approve strangers in.
   - Suggest a bot owner, and rejecting join requests to `isDemo` houses.
7. **`Backend: Demo module`** (Seed, "also called by the reset"): it must keep demo and bot user IDs stable (upsert by email). Otherwise every judge's 30-day token returns 401 after the nightly reset.
8. **`Stack`** (Tests row): "Jest + Supertest (the NestJS default)" is outdated. In v12, `nest new` defaults to ESM + Vitest (and picks ESM when run without a terminal); Jest is the CommonJS option and needs Node ≥ 24.9. Not reopening the choice: just scaffold as CommonJS.
9. **`Stack` / `File Structure`:**
   - `main.ts` uses a "validation pipe", but `class-validator`/`class-transformer` (and the `@nestjs/throttler` 6.7, `supertest` and `jest` versions) aren't in the Stack table or the dependency list.
   - `vercel.json` is described as SPA-rewrite only; it should also carry the CSP and `nosniff` headers.
   - `FRONTEND_ORIGIN` is a single value, but local dev (`localhost:5173`) and any previews need a list.
10. **`Decisions and Open Issues > Agent details, changeable at review`:** "JWT stored in local storage" has no XSS mitigation (the CSP above) and no revocation story. Suggest adding "rotate `JWT_SECRET` to sign everyone out".
11. *(Verify early, build slice 1)* Whether Fly overwrites a client-sent `Fly-Client-IP`, and the true `X-Forwarded-For` layout. Curl the deployed API with forged headers and temporarily log what it sees.

## 7. Sources (accessed 2026-10-03)
- NestJS Authentication (JwtService guard, global guard, `@Public`): https://docs.nestjs.com/security/authentication
- NestJS Passport recipe: https://docs.nestjs.com/recipes/passport
- NestJS rate limiting (proxies, trust proxy): https://docs.nestjs.com/security/rate-limiting
- NestJS CORS: https://docs.nestjs.com/security/cors
- NestJS validation: https://docs.nestjs.com/techniques/validation
- NestJS custom decorators: https://docs.nestjs.com/custom-decorators
- NestJS testing: https://docs.nestjs.com/fundamentals/testing
- NestJS v12 migration guide (ESM, Vitest default, Jest on Node ≥ 24.9): https://docs.nestjs.com/migration-guide
- NestJS CLI `nest new`: https://docs.nestjs.com/cli/usages
- @nestjs/jwt: https://github.com/nestjs/jwt
- @nestjs/throttler: https://github.com/nestjs/throttler
- node-argon2 README (prebuilds, options): https://github.com/ranisalt/node-argon2 ; options wiki: https://github.com/ranisalt/node-argon2/wiki/Options ; npm tarball listing via `npm pack argon2@0.45.1 --dry-run`
- OWASP Password Storage Cheat Sheet (argon2id parameters): https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP HTML5 Security Cheat Sheet (local storage): https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
- RFC 7518 §3.2 (HMAC key size): https://www.rfc-editor.org/rfc/rfc7518#section-3.2
- Fly request headers (`Fly-Client-IP`, `X-Forwarded-For`): https://fly.io/docs/networking/request-headers/
- Fly CPU performance (shared-CPU quota and bursting): https://fly.io/docs/machines/cpu-performance/
- Express behind proxies (`trust proxy`): https://expressjs.com/en/guide/behind-proxies.html
- Prisma error reference (P2002): https://www.prisma.io/docs/orm/reference/error-reference ; customizing migrations (extensions): https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations
- Vercel generated URLs: https://vercel.com/docs/deployments/generated-urls
- Vercel Deployment Protection: https://vercel.com/docs/deployment-protection
- Vercel project configuration (`headers`): https://vercel.com/docs/project-configuration
- Vercel Toolbar CSP: https://vercel.com/docs/vercel-toolbar/managing-toolbar
- TanStack Query (`QueryCache`/`retry`): https://tanstack.com/query/latest/docs/reference/QueryClient
