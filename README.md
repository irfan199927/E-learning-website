# E-learner

A learning platform for schools: live classes on Google Meet, recordings auto-synced into a gated HLS video
library, schedules, and progress tracking for students, teachers and parents. It is built India-first
(Asia/Kolkata, DPDP Act, K-12 minors).

## What it does today

| Who         | Can                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Teacher** | Schedule single or weekly classes (Calendar event + Meet link + invites) and drag to reschedule; upload videos up to 4 GB; see their courses and students          |
| **Student** | Join a class from 10 min before start; watch lessons (resumes where they left off); see their streak, today's watch time, monthly activity and per-course progress |
| **Parent**  | See their verified child's class schedule (read-only)                                                                                                              |
| **Admin**   | Everything a teacher can, across all courses                                                                                                                       |

Behind the scenes:

- Reminders go out 24 h and 15 min before each class.
- Meet recordings are imported and transcoded to 360p/720p HLS.
- Attendance comes from Meet participant sessions.
- Calendar changes sync both ways with Google.

## Quickstart

Prerequisites: Node 22, pnpm 10, Docker, and ffmpeg (for the worker).

```bash
pnpm install
pnpm infra:up                      # postgres, redis, minio, mailpit (docker compose)
cp .env.example .env               # fill the secrets; comments explain each one
pnpm db:migrate && pnpm db:seed
pnpm dev                           # web on :3000 + worker
```

Sign in at http://localhost:3000 as `teacher@school.edu`, `aanya@school.edu` (student) or
`parent@example.com`. The password for all of them is `Password123!`. Emails land in Mailpit at
http://localhost:8025.

## Repo map

```
apps/web          Next.js 15 App Router: UI + REST API (/api/v1/*), Better Auth at /api/auth/*
apps/worker       BullMQ jobs: reminders, recording sync + attendance, ffmpeg HLS transcode, calendar sync
packages/core     Pure domain logic: RBAC, errors, crypto, time/tz, learning/streaks, zod schemas, ics, HLS
packages/db       Prisma 7 schema, migrations, seed, client
packages/google   Google OAuth + Calendar/Meet/Drive wrapper
packages/storage  S3-compatible storage (R2 in prod, MinIO locally)
packages/queue    Job names, payload schemas, producers (the web ↔ worker contract)
packages/notify   SMTP mailer + email templates
docs/             Spec, system design, UI guide, next steps
```

## Scripts

| Command                                              | What it does                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                                           | Web + worker in watch mode                                      |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` | Static checks (also run by the pre-commit hook)                 |
| `pnpm test`                                          | Unit tests, all packages                                        |
| `pnpm --filter @elearner/web test:int`               | Web integration tests against real Postgres                     |
| `pnpm --filter @elearner/worker test:int`            | Worker integration tests, including a real ffmpeg transcode     |
| `pnpm --filter @elearner/web build && pnpm test:e2e` | Playwright smoke tests (desktop + mobile) on a production build |
| `pnpm db:migrate` · `pnpm db:seed`                   | Apply migrations and seed demo users (never in production)      |

## Documentation

- [`CLAUDE.md`](CLAUDE.md): layout, commands, architecture rules, gotchas. Read this first.
- [`docs/SPEC.md`](docs/SPEC.md): product spec, user stories, API list.
- [`docs/architecture.md`](docs/architecture.md): system design, flows, data model, failure modes, trade-offs.
- [`docs/ui.md`](docs/ui.md): app shell, screens per role, UI rules.
- [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md): what's left, in priority order.
- [`CHANGELOG.md`](CHANGELOG.md): what changed, and when.

## Contributing

Use conventional commits (enforced by commitlint). Pre-commit runs lint-staged. Keep route handlers free of
`@elearner/db` imports; they go through services (see CLAUDE.md, "Architecture rules").
