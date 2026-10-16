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
- [x] Static landing site: `pnpm build:site` + root `vercel.json` (docs/deployment.md "Static landing site")
- [x] Import the repo in Vercel to publish the static landing site
- [ ] Free-tier deploy of the full app (docs/deployment.md "Free-tier setup"): Neon, Upstash, R2, Brevo, second Vercel
      project, Google OAuth (open sign-up), GitHub `production` environment; then set `SITE_APP_URL` on the static
      project
- [ ] Add the worker (Render) when reminders, recording import and transcoding are needed (`WORKER_ENABLED=true`)
- [ ] Do the one-time setup in `docs/deployment.md` (accounts, secrets, branch protection), then first deploy.
- [x] GitHub Actions pinned to commit SHAs (`# vX.Y.Z` comment; Dependabot updates both), at the versions that ran green.
- [x] Worker image size: `googleapis` replaced by `@googleapis/calendar`, `/drive`, `/meet` (production
      `node_modules` 354 MB → 174 MB).

## 3. Documentation set (user asked for proper docs)

- [x] `README.md` (overview, quickstart, repo map, scripts)
- [x] `docs/ui.md` (app shell, screens per role, UI rules) and `CHANGELOG.md`
- [x] `CONTRIBUTING.md` (branching, conventional commits, PR checklist, definition of done)
- [x] `SECURITY.md` + `docs/security.md` (threat model, controls, DPDP handling)
- [x] `docs/architecture.md` — system design (requirements, flows, load estimates, failure modes, trade-offs)
- [x] G4 reminder reconciliation and G6 raw-file cleanup (`docs/architecture.md` §7)
- [ ] Remaining design gaps G2, G3, G5, G7 in `docs/architecture.md` §7 (G5 needs real accounts in the pilot; G7 is a
      hosting decision)
- [x] `docs/adr/0001…0007` — monorepo; route handlers + worker vs NestJS; Better Auth + DB sessions; Prisma 7;
      R2 + gated HLS playlists; separate Google API grant (Internal OAuth app); recurring classes as Google instances
- [x] `docs/environment.md` (every env var — source of truth is apps/web/src/env.ts + apps/worker/src/env.ts)
- [x] `docs/google-setup.md` (GCP project, Internal consent screen, scopes, Workspace recording policy)
- [x] `docs/deployment.md` (Vercel, Render, Neon, Redis w/ `noeviction`, R2 bucket + CORS exposing `ETag`, rollback)
- [ ] `docs/testing.md`, `docs/api.md` (+ OpenAPI), runbooks: recording-sync, transcode-failures, google-reconnect,
      restore-database, rotate-secrets, incident-response

## 4. Product (MVP backlog from docs/SPEC.md)

- [x] Open Google sign-up; students ask to join courses, teachers approve (`JoinRequest`); teachers create courses
- [ ] Admin: user CSV import, role management UI (now a workflow), removing students, parental-consent flow (DPDP) UI
- [ ] Courses/modules/lessons CRUD + attachments (course pages exist since 2026-10-16 but list READY videos in upload
      order; switch `server/services/learning.ts` to Module/Lesson order once CRUD lands)
- [x] Library listing: `/courses` (My courses with All / In progress / Completed) and `/courses/:id` lesson list
- [x] Learner progress: streak, today's watch time, monthly activity calendar, resume card (`LearningDay` table)
- [x] Public landing page at `/` (animated, advertises a course, Enroll → sign-in). Copy is SAMPLE content in
      `apps/web/src/app/(marketing)/course.ts`
- [ ] Replace the sample landing copy with a real course, or render it from a published `Course` once course CRUD
      exists; add real (consented) student work or testimonials if the school has them
- [x] Light/dark theme switch (cookie, no flash) across landing, sign-in and app; light "product launch" landing theme
- [ ] Apply the same polish pass (motion tokens, skeleton loaders, empty-state illustrations) to the signed-in app
- [ ] Parent view of a child's progress (lessons completed, streak) — read-only, per verified ParentLink
- [ ] Per-school daily watch goal (now a 30-min constant in `dashboard/page.tsx`)
- [ ] "Questions attempted" on Today's progress once MCQ quizzes exist
- [ ] Course cover images (optional upload; `CourseTile` is the fallback)
- [ ] Assignments & MCQ quizzes; teacher attendance page with manual override
- [ ] In-app notifications UI; Razorpay checkout + webhooks
- [ ] i18n (next-intl: en/hi/mr), PWA
