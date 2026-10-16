# CLAUDE.md — E-learner

Context for Claude Code (and humans) working in this repo. Read this first.

## What this is

School e-learning platform: teachers schedule live classes on Google Meet, recordings sync from Drive into a gated
HLS video library, students join/watch/track progress, parents get read-only views. India-first (Asia/Kolkata,
DPDP Act). Students are all adults (18+): there is no parental-consent flow. Full product spec: `docs/SPEC.md`. UI design: the "E-learner" Design canvas (design system,
student dashboard, teacher calendar, lesson player, mobile, architecture) and `docs/ui.md` (shell, screens, UI rules).

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
pnpm db:generate && pnpm db:migrate && pnpm db:seed   # seeded users: *@school.edu / parent@example.com, password Password123!
pnpm dev                      # web :3000 + worker

pnpm typecheck | pnpm lint | pnpm test          # unit tests (all packages)
pnpm --filter @elearner/web test:int            # integration: real Postgres (DATABASE_URL)
pnpm --filter @elearner/worker test:int         # integration incl. real ffmpeg transcode
pnpm --filter @elearner/web build && pnpm test:e2e   # Playwright smoke vs production build
pnpm build:site                                 # static landing page only → apps/web/out (Vercel)
deploy/uat/deploy.sh                            # on the UAT VM: build, migrate, restart (docs/uat.md)
docker build -f apps/web/Dockerfile -t elearner-web .       # images build from the repo root (docs/deployment.md)
docker build -f apps/worker/Dockerfile -t elearner-worker .
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
- Google APIs use the per-API packages (`@googleapis/calendar`, `/drive`, `/meet`), not the 190 MB `googleapis`.
  `google-auth-library` is pinned via pnpm override so they and our code share one instance (type clash otherwise);
  bump them together (the newer majors need auth library 11).
- Better Auth 1.7 rate-limit custom storage needs atomic `consume()` (Redis Lua in `lib/rate-limit.ts`), not get/set.
- Better Auth core tables (User/Session/Account/Verification) must keep its field names; `emailVerified` is Boolean.
- Worker bundles workspace packages with tsup but keeps npm deps external — runtime deps of bundled packages are
  listed in `apps/worker/package.json` on purpose.
- Prisma 7: `prisma.config.ts` holds the datasource URL; generated client lives in `packages/db/src/generated` (gitignored).
  `migrate dev` no longer generates it, and only turbo tasks depend on `generate`: anything run outside turbo
  (`db:seed`, `test:int`) on a fresh checkout needs `pnpm db:generate` first (CI does this explicitly).
- Initial migration `20261015000000_init` has not been deployed anywhere yet; after first deploy, never edit it — add new migrations.
- Streak / activity days are the learner's LOCAL date (`localDayKey(now, actor.timezone)`), stored in `LearningDay.day`
  (`@db.Date`). Never bucket learner activity by UTC day.
- Playwright starts the server with `APP_URL=http://localhost:3100` (playwright.config.ts). If APP_URL doesn't match
  the browser's origin, Better Auth returns 403 and the sign-in form shows "Confirm your email first".
- Integration tests share the dev database: fixture ids/slugs/Google event ids must be unique per run (`randomUUID`).
- Mobile nav drawer must stay `invisible` when closed, or its off-screen links remain in the tab order.
- Worker image: `pnpm deploy --legacy` (pnpm 10) with `auto-install-peers=false`, or the optional peers of
  `@prisma/client` (Prisma CLI, Studio, TypeScript, ~215 MB) land in production `node_modules`.
- `pnpm install` under `NODE_ENV=production` skips devDependencies: never set it job-wide in CI before installing.
- e2e locators: use `exact: true` for nav links. Empty-state copy ("See my courses") also matches substrings.
- MinIO no longer publishes `minio/minio` images; compose uses pinned `pgsty/minio` (also ships `mc`).
- Workflow actions are pinned to commit SHAs with a `# vX.Y.Z` comment; add new ones the same way (`git ls-remote --tags`).
- CI = `.github/workflows/ci.yml` (PRs; called by deploy.yml on main). Deploy needs one-time setup: `docs/deployment.md`.
- `/` is the public landing page (`app/(marketing)`, scoped CSS under `.lp`); course copy lives in `course.ts`. The
  vendored `components/ui/glyph-portal.tsx` must keep its MIT notice; only type-level edits were made to it.
- Theme: `<html data-theme>` comes from the `theme` cookie (root layout); none = follow the OS. Dark tokens exist twice
  (explicit + media query); change both. Brand blue as text = `text-primary-fg`, never `text-primary`.
- Static landing export: `STATIC_SITE=1` builds ONLY `*.site.tsx` routes (pageExtensions) into `apps/web/out`. Keep
  page logic in shared modules (`landing-view.tsx`, `root-html.tsx`); a `*.site.tsx` file must not use cookies,
  headers, the DB or anything server-only. Root `vercel.json` is for this static project only.
- Access model: anyone may sign up with Google (auth.ts `databaseHooks.user.create` makes them an active STUDENT);
  course content still needs an Enrollment, created only when the teacher approves a `JoinRequest`. Students are
  adults: no date of birth, no parental consent (removed in migration `remove_parental_consent`). Admins manage
  accounts at `/admin/users` (services/admin-users.ts: invites via `deps.sendPasswordSetup`, which reuses Better
  Auth's reset flow); `pnpm db:set-role` / `db:create-user` are for bootstrapping the first admin.
- Course content: a course is ordered Modules → Lessons (`services/course-content.ts` edits, `learning.ts` reads).
  Students see published lessons only, video lessons once READY (`visibleLessonWhere`); every video has a lesson
  (uploads, recordings), else it's a staff-only "loose video". Completion = VideoProgress for videos,
  LessonProgress ticks otherwise. Attachments: presigned PUT, then `completeAttachment` rebuilds the key and
  checks the real size; downloads redirect with `Content-Disposition: attachment`.
- Parents see children only through a VERIFIED `ParentLink` (`services/parents.ts`); the child view reuses the
  learner read models with the child as the Actor (child's timezone). Links are made by an admin on the Users page.
- Classes without Google (`meeting: "none"`): no googleEventId/meetConferenceId, room in `location`, optional
  pasted link in `meetLink`; series expanded locally (`expandWeekly`). Reschedule/cancel only call Google when
  `googleEventId` is set. Attendance (`services/attendance.ts`): source MANUAL beats MEET_API (worker skips it).
- Assignments (`services/assignments.ts`) and quizzes (`services/quizzes.ts`): students see published ones of
  enrolled courses only (NOT_FOUND otherwise). Quiz correct options never leave the server before submit; scoring
  is `scoreQuiz` in core. Submission files must live under `keys.submissionPrefix(assignment, student)`.
- Gradebook (`services/gradebook.ts`, `/courses/:id/grades`): cell and total rules are `gradeCell`/`gradeTotal`
  in core (overdue + nothing handed in = 0; ungraded or not-due work left out). CSV goes through core `toCsv`
  (formula-injection escaping); exports are audited `grade.export`.
- Notifications: write them with `notifyUsers` (services/notifications.ts; pass a `dedupeKey` for "once per item")
  or `notification.create` in a transaction; links must be same-site paths (`safeLink` drops anything else).
- Icon-only buttons: `w-11 px-0!` (Tailwind 4 important suffix); plain `px-0` loses to the base `px-4`.
- Hosting: only the static landing page is on Vercel. The full app runs as Docker images: UAT on a home-lab VM
  (`deploy/uat/`, docs/uat.md; the VM pulls green `main` commits, no self-hosted runner because the repo is
  public), production later on AWS. Google is optional: empty `GOOGLE_CLIENT_ID` = password sign-in only.
- Plain-HTTP hosts (LAN UAT): CSP `upgrade-insecure-requests` and secure cookies switch on only when `APP_URL` is
  https. Empty env strings mean unset (Compose passes `""`), so optional zod fields must accept `""`.
- Restarting `next start` locally: `pkill -x next-server` does NOT match (the process name includes the version), so a
  stale server keeps serving old asset hashes (CSS 404 as text/html). Kill by PID.

## Status (end of first build session)

Done & verified: monorepo, schema + migration, all packages, web API + UI (sign-in, reset, dashboard, calendar w/
scheduling + drag reschedule, upload, player), worker jobs. 89 tests green (52 unit + 23 integration on real Postgres incl.
real ffmpeg + 14 Playwright e2e desktop/mobile); lint + prettier clean), web production build + worker build pass.

Public landing page at `/` (2026-10-16): animated course advert, Enroll → sign-in; see `docs/ui.md` "Landing page".
Learner redesign (2026-10-16): sidebar/drawer shell, streak, student Overview (resume card, today's progress, monthly
activity), My courses with filters, course pages. UI rules and per-role screens: `docs/ui.md`. History: `CHANGELOG.md`.

See `docs/NEXT_STEPS.md` for what's left.
