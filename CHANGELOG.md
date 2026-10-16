# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Dates are in IST.

## [Unreleased]

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
