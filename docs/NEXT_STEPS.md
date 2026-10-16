# Next steps (handoff)

Ordered by priority. Each item is self-contained enough to hand to Claude Code as one task.

## 1. Finish the quality gate (small)

- [x] `pnpm lint` and `pnpm format:check` pass (enforced by pre-commit hooks).
- [x] Re-check the calendar toolbar styling after the CSP `font-src data:` fix (prev/next icons render; verified 2026-10-15).

## 2. Delivery (needed before first deploy)

- [ ] `apps/web/Dockerfile` (Next `output: "standalone"`) and `apps/worker/Dockerfile` (node:22-slim + ffmpeg, non-root user, `pnpm deploy`).
- [ ] `.github/workflows/ci.yml`: format → lint → typecheck → unit → integration (postgres+redis service containers,
      `prisma migrate deploy`) → build → Playwright e2e (playwright.config.ts already sets `APP_URL` and
      `AUTH_SIGNIN_LIMIT_PER_MIN` for its server).
- [ ] e2e: assert a class's start time on the calendar (would have caught the UTC rendering bug fixed in 8a4c37a).
- [ ] `docker-compose.yml`: the pinned `minio/minio` / `minio/mc` images no longer pull; pick a maintained image.
- [ ] `.github/workflows/deploy.yml`: on main → `pnpm db:deploy` (prod) → deploy web (Vercel) + worker (Render/Fly), gated by environment approval.
- [ ] Dependabot/Renovate, CODEOWNERS, PR template, commitlint already configured in package.json.

## 3. Documentation set (user asked for proper docs)

- [x] `README.md` (overview, quickstart, repo map, scripts)
- [x] `docs/ui.md` (app shell, screens per role, UI rules) and `CHANGELOG.md`
- [ ] `CONTRIBUTING.md` (branching, conventional commits, PR checklist, definition of done)
- [ ] `SECURITY.md` + `docs/security.md` (threat model, controls, DPDP handling)
- [x] `docs/architecture.md` — system design (requirements, flows, load estimates, failure modes, trade-offs)
- [ ] Fix remaining design gaps G2–G7 listed in `docs/architecture.md` §7 (G4 reminder reconciliation and G6 raw-file lifecycle first)
- [ ] `docs/adr/0001…0007` — monorepo; route handlers + worker vs NestJS; Better Auth + DB sessions; Prisma 7;
      R2 + gated HLS playlists; separate Google API grant (Internal OAuth app); recurring classes as Google instances
- [ ] `docs/environment.md` (every env var — source of truth is apps/web/src/env.ts + apps/worker/src/env.ts)
- [ ] `docs/google-setup.md` (GCP project, Internal consent screen, scopes, Workspace recording policy)
- [ ] `docs/deployment.md` (Vercel, Render, Neon, Redis w/ `noeviction`, R2 bucket + CORS exposing `ETag`)
- [ ] `docs/testing.md`, `docs/api.md` (+ OpenAPI), runbooks: recording-sync, transcode-failures, google-reconnect,
      restore-database, rotate-secrets, incident-response

## 4. Product (MVP backlog from docs/SPEC.md)

- [ ] Admin: user CSV import, enrollments, parental-consent flow (DPDP) UI
- [ ] Courses/modules/lessons CRUD + attachments (course pages exist since 2026-10-16 but list READY videos in upload
      order; switch `server/services/learning.ts` to Module/Lesson order once CRUD lands)
- [x] Library listing: `/courses` (My courses with All / In progress / Completed) and `/courses/:id` lesson list
- [x] Learner progress: streak, today's watch time, monthly activity calendar, resume card (`LearningDay` table)
- [ ] Parent view of a child's progress (lessons completed, streak) — read-only, per verified ParentLink
- [ ] Per-school daily watch goal (now a 30-min constant in `dashboard/page.tsx`)
- [ ] "Questions attempted" on Today's progress once MCQ quizzes exist
- [ ] Course cover images (optional upload; `CourseTile` is the fallback)
- [ ] Assignments & MCQ quizzes; teacher attendance page with manual override
- [ ] In-app notifications UI; Razorpay checkout + webhooks
- [ ] i18n (next-intl: en/hi/mr), PWA
