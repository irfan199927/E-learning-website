# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Dates are in IST.

## [Unreleased]

### Changed — CI hardening and a smaller worker image (2026-10-16)

- Every third-party GitHub Action is pinned to a full commit SHA, with the release in a trailing comment
  (`actions/checkout@fbc6f39… # v5.1.0`). A moved or hijacked tag can no longer change what CI runs. Dependabot's
  weekly `actions` group bumps the SHA and the comment together.
- `packages/google` uses the per-API clients `@googleapis/calendar`, `@googleapis/drive` and `@googleapis/meet` instead
  of the full `googleapis` bundle. The worker's production `node_modules` drops from 354 MB to 174 MB. Requests are
  unchanged.

### Added — static landing site for Vercel (2026-10-16)

- `pnpm build:site` exports just the public landing page as static files (`apps/web/out`, about 1.2 MB). It shares
  its source with the app's `/` route through `*.site.tsx` route files and `STATIC_SITE=1` in `next.config.ts`.
- The root `vercel.json` holds the build, output, security and cache-header settings, so a Vercel project only needs
  the repository imported.
- Without a deployed app, Enroll and Sign in go to a new "Online enrolment opens soon" page. Setting
  `SITE_APP_URL` points them at the real sign-in instead.
- The theme switch re-applies a saved choice on the static site, where no server can read the cookie.
- New CI job **Static landing site** builds and checks the export on every PR.

### Added — light/dark theme switch and a light landing page (2026-10-16)

- **Theme switch** on every page: the landing header, the app top bar and the sign-in pages.
  - The choice is kept in a cookie and rendered on the server, so there's no flash of the wrong theme.
  - With no choice, the site follows the OS.
  - Switching animates as a circle growing from the button.
- **Light landing page**, now the default for light-mode visitors:
  - product-launch style with huge heavy headlines;
  - a blue → violet → pink → orange gradient through the CODE letters;
  - frosted header, soft-shadow cards and pill buttons.
  - The terminal look stays as the dark theme.
- **Fixed:** in dark mode, brand-blue text (active sidebar item, links) was hard to read. New `primary-fg` tokens keep
  it readable in both themes.
- e2e: the switch flips the theme, updates `aria-pressed`, and the server renders the saved choice after reload.

### Added — public landing page (2026-10-16)

- `/` is now an animated landing page advertising a sample coding course ("Code Foundations"). It used to be a
  redirect to the dashboard. Every **Enroll** button leads to sign-in, then on to My courses. Signed-in visitors get
  "Go to dashboard".
- Hero: **Glyph Portal** (`src/components/ui/glyph-portal.tsx`, MIT). Scrolling flies the camera through the word
  CODE and into the course.
- Other sections:
  - course facts;
  - a technology marquee;
  - a self-typing code editor;
  - a 12-week curriculum timeline;
  - project cards;
  - the next batch;
  - FAQ and the final CTA.
- Design direction from the ui-ux-pro-max skill: a dark terminal theme, JetBrains Mono headings and a green
  action colour. Motion respects reduced-motion and no-JS visitors.
- The sign-in page logo now links back to the landing page.
- e2e: `landing.spec.ts` covers the content, the Enroll → sign-in → My courses flow, the signed-in state, and
  reduced motion.

### Added — delivery: Docker images, CI and deploy (2026-10-16)

- `apps/web/Dockerfile` (Next standalone, ~470 MB, non-root, healthcheck) and `apps/worker/Dockerfile`
  (ffmpeg, production-only dependencies via `pnpm deploy`, non-root, healthcheck), plus `.dockerignore`.
- CI (`.github/workflows/ci.yml`):
  - format, lint, typecheck and unit tests;
  - integration tests on Postgres with real ffmpeg, after migrating from an empty database;
  - a production build, then Playwright on desktop and mobile;
  - Docker image builds with smoke tests.
- Deploy (`.github/workflows/deploy.yml`): CI → approval on the `production` environment → migrations →
  Vercel (web) and GHCR → Render (worker). It stays off until `DEPLOY_ENABLED=true`.
- Dependabot, CODEOWNERS and a PR template.
- `docs/deployment.md`: one-time setup, secrets, releasing, rollback.
- e2e regression test: the calendar shows a 10:30 IST class at 10:30 in a UTC browser.

### Changed

- `docker-compose.yml`: MinIO no longer publishes `minio/minio` / `minio/mc` images. Local S3 now uses the pinned
  community build `pgsty/minio:RELEASE.2026-08-04T00-00-00Z`.
- Playwright loads the root `.env` (for test fixtures) and starts its server with `NODE_ENV=production`.
- CI runs on pull requests. On `main` it runs once, as the first job of Deploy.

### Fixed

- The e2e "My courses" locator also matched the Overview's "See my courses" link on a fresh database.
- CI integration and e2e jobs (and the quickstart) now run `pnpm db:generate` first. The seed and integration tests
  import the gitignored Prisma client, which nothing had generated on a fresh checkout.

### Added — learner experience redesign (2026-10-16)

- **New app shell.**
  - On desktop, a sidebar with icons and an active pill.
  - On mobile, a slide-in drawer (menu button, Escape to close, closed drawer out of the tab order).
  - A top bar with the user's initials, name and role.
- **Learning streak** in the top bar for students: consecutive days with lesson time, on the student's own clock.
- **Student Overview:**
  - a Resume learning card (next lesson, X/Y lessons completed, progress ring);
  - Today's progress (minutes watched against a 30-minute goal, lessons completed, courses in progress);
  - a Monthly progress calendar with previous/next month;
  - Upcoming classes alongside.
- **Teacher Overview:** a "Your courses" panel with student and lesson counts.
- **My courses** (`/courses`): All / In progress / Completed filters, course covers, and Start / Resume /
  Review CTAs.
- **Course page** (`/courses/:id`): the lesson list with completed and partly-watched states. Teachers also see
  videos that are still processing or that failed.
- The lesson page links back to its course.
- `LearningDay` table and migration `20261016011408_learning_days`. Each progress beacon also adds its watch
  time to the learner's local day.
- `@elearner/core/learning`: `localDayKey`, `learningStreak`, `monthGrid`, `shiftMonth`, `courseProgressState`,
  `percent`.
- Docs: `docs/ui.md`, this changelog, an expanded README, and updates to architecture.md, CLAUDE.md and
  NEXT_STEPS.md.
- Tests: core unit tests for the streak and calendar rules, `learning.int.test.ts`, and e2e tests for the
  student overview, My courses, the mobile drawer and the parent redirect.

### Fixed

- The calendar rendered in UTC while labelled Asia/Kolkata, which hid morning classes in week view (`8a4c37a`).
- The Join button's "Opens 3:50 pm" now uses the school's timezone, not the browser's.
- e2e: Playwright now passes `APP_URL` for its own port. Before, every sign-in got a 403 unless you set it by
  hand.
- Integration test for weekly series used fixed Google event ids, so it failed on its second run against the
  same database.
- `prisma.config.ts`, the seed and `next.config.ts` now load the root `.env` in local dev (`fb12e0f`).

## [0.1.0] — 2026-10-15

- Initial monorepo:
  - web app: auth, dashboard, calendar with scheduling and drag-reschedule, upload, HLS player;
  - worker: reminders, recording sync, transcode, calendar sync;
  - shared packages, Prisma schema and migration;
  - 89 tests.
