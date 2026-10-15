# CLAUDE.md — E-learner

Context for Claude Code (and humans) working in this repo. Read this first.

## What this is

School e-learning platform: teachers schedule live classes on Google Meet, recordings sync from Drive into a gated
HLS video library, students join/watch/track progress, parents get read-only views. India-first (Asia/Kolkata,
DPDP Act, K-12 minors). Full product spec: `docs/SPEC.md`. UI design: the "E-learner" Design canvas (design system,
student dashboard, teacher calendar, lesson player, mobile, architecture).

## Layout (pnpm + Turborepo monorepo)

```
apps/web      Next.js 15 App Router — UI + REST API (/api/v1/*), Better Auth at /api/auth/*
apps/worker   BullMQ consumers: reminders, recording sync + attendance, ffmpeg HLS transcode, calendar sync, maintenance
packages/core     Pure domain logic (RBAC, errors, crypto, time/tz, zod schemas, ics, hls rewrite). No I/O.
packages/db       Prisma 7 schema, migrations, seed, client (driver adapter: @prisma/adapter-pg)
packages/google   Google OAuth (teacher API grant), Calendar/Meet/Drive wrapper + retry policy, encrypted credential store
packages/storage  S3-compatible storage (R2 prod / MinIO local): multipart, presign, streaming put
packages/queue    Queue names, zod job payloads, producers (Jobs class) — shared contract web ↔ worker
packages/notify   SMTP mailer + email templates
```

## Commands

```bash
pnpm install
pnpm infra:up                 # docker compose: postgres, redis, minio, mailpit
cp .env.example .env          # fill secrets (see comments)
pnpm db:migrate && pnpm db:seed   # seeded users: *@school.edu / parent@example.com, password Password123!
pnpm dev                      # web :3000 + worker

pnpm typecheck | pnpm lint | pnpm test          # unit tests (all packages)
pnpm --filter @elearner/web test:int            # integration: real Postgres (DATABASE_URL)
pnpm --filter @elearner/worker test:int         # integration incl. real ffmpeg transcode
pnpm --filter @elearner/web build && pnpm test:e2e   # Playwright smoke vs production build
```

## Architecture rules (enforced by ESLint where possible)

- **Layers:** route handler → service → Prisma. Routes use `route()`/`publicRoute()` from `apps/web/src/lib/http.ts`
  (auth, role gate, same-origin check, rate limit, zod, problem+json) and must NOT import `@elearner/db`.
- **Services** (`apps/web/src/server/services/*`) take `(deps: Deps, actor: Actor, input)`. Never import env/singletons;
  production wiring is `server/container.ts`, tests pass fakes (`src/test/fakes.ts`).
- **Access control:** role checks via `assertCan()` (core/rbac.ts) + resource checks via `server/policies.ts`.
  Enrollment is the single gate for paid/course content. Unauthorized resource access returns NOT_FOUND (no id leaks).
- **Google first, then DB** when scheduling; compensate (delete event) if the DB write fails.
- **Jobs** are idempotent with deterministic jobIds (no ":" allowed in BullMQ custom ids). Payloads validated by zod on both sides.
- `packages/*` must stay framework-agnostic (no next/react imports).
- Client components import browser-safe subpaths only: `@elearner/core/time`, `/schemas`, `/rrule` (root pulls node:crypto).

## Gotchas learned the hard way

- Nonce CSP (middleware.ts) requires dynamic rendering → root layout has `dynamic = "force-dynamic"`. Static pages would hydrate-fail.
- FullCalendar's icon font is a data: URI → CSP `font-src 'self' data:`.
- Fonts are self-hosted via `@fontsource-variable/*` + `next/font/local` (builds must not need Google Fonts).
- `google-auth-library` is pinned via pnpm override so googleapis + our code share one instance (type clash otherwise).
- Better Auth 1.7 rate-limit custom storage needs atomic `consume()` (Redis Lua in `lib/rate-limit.ts`), not get/set.
- Better Auth core tables (User/Session/Account/Verification) must keep its field names; `emailVerified` is Boolean.
- Worker bundles workspace packages with tsup but keeps npm deps external — runtime deps of bundled packages are
  listed in `apps/worker/package.json` on purpose.
- Prisma 7: `prisma.config.ts` holds the datasource URL; generated client lives in `packages/db/src/generated` (gitignored).
- Initial migration `20261015000000_init` has not been deployed anywhere yet; after first deploy, never edit it — add new migrations.

## Status (end of first build session)

Done & verified: monorepo, schema + migration, all packages, web API + UI (sign-in, reset, dashboard, calendar w/
scheduling + drag reschedule, upload, player), worker jobs. 89 tests green (52 unit + 23 integration on real Postgres incl.
real ffmpeg + 14 Playwright e2e desktop/mobile); lint + prettier clean), web production build + worker build pass.

See `docs/NEXT_STEPS.md` for what's left.
