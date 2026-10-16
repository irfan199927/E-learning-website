# Next steps (handoff)

Ordered by priority. Each item is self-contained enough to hand to Claude Code as one task.

## 1. Finish the quality gate (small)

- [x] `pnpm lint` and `pnpm format:check` pass (enforced by pre-commit hooks).
- [x] Re-check the calendar toolbar styling after the CSP `font-src data:` fix (prev/next icons render; verified 2026-10-15).

## 2. Delivery (needed before first deploy)

- [x] `apps/web/Dockerfile` (Next standalone, non-root, healthcheck) and `apps/worker/Dockerfile` (node:22 slim + ffmpeg,
      non-root, `pnpm deploy --prod`), `.dockerignore`. Web image verified locally; worker verified up to the ffmpeg
      layer (Debian mirrors were unreachable from the build sandbox; the CI `docker` job covers it).
- [x] `.github/workflows/ci.yml`: checks → integration (Postgres service, real ffmpeg, migrate from zero) → build +
      Playwright e2e → docker build + smoke. Replayed locally in a clean clone with the workflow's env: green.
- [x] `.github/workflows/deploy.yml`: CI → `production` approval → `prisma migrate deploy` → Vercel (web) +
      GHCR/Render (worker). Off until `DEPLOY_ENABLED=true`; setup in `docs/deployment.md`.
- [x] Dependabot (npm, actions, docker, compose; grouped), CODEOWNERS, PR template.
- [x] e2e: calendar shows a class at its school-timezone time in a UTC browser (fails if the 8a4c37a fix regresses).
- [x] `docker-compose.yml`: MinIO stopped publishing images; switched to pinned `pgsty/minio` (server + `mc`).
- [ ] Do the one-time setup in `docs/deployment.md` (accounts, secrets, branch protection), then first deploy.
- [ ] Pin GitHub Actions to commit SHAs (Dependabot keeps them current) once the workflows have run green on GitHub.
- [ ] Worker image size: ~190 MB of `node_modules` is `googleapis`; switch to the per-API packages
      (`@googleapis/calendar`, `/drive`, `/meet`) in `packages/google`.

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
- [x] `docs/deployment.md` (Vercel, Render, Neon, Redis w/ `noeviction`, R2 bucket + CORS exposing `ETag`, rollback)
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
