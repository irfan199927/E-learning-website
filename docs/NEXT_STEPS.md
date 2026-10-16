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
- [x] UAT stack for a home-lab VM (`deploy/uat/`, docs/uat.md): Compose, auto-deploy of green `main`, user tools
- [ ] Set up the UAT VM: `sudo bash bootstrap.sh <LAN IP>`, then create the first users (docs/uat.md)
- [ ] Public HTTPS for UAT (Cloudflare Tunnel) so Google sign-in works; then `SITE_APP_URL` on the landing page
- [ ] Production on AWS (docs/deployment.md "Production on AWS"): IaC, ECR, ECS, RDS, ElastiCache, S3+CloudFront,
      SES, OIDC deploy role; ADR for the choices
- [ ] Protect `main` with the required CI checks (docs/deployment.md, "Branch protection")
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
- [x] Admin Users page (`/admin/users`): add one or CSV import with email invites, roles, switch off/on; course
      roster with Remove
- [x] ~~Parental consent~~: removed (2026-10-16). Students are all 18+, so no date of birth or parent approval
- [ ] Recording consent (`ConsentType.RECORDING`); a search box for long course catalogs
- [x] Courses/modules/lessons CRUD + attachments (2026-10-16): `/courses/:id/edit`, lesson editor with files,
      lesson page with Mark as done; course pages follow Module/Lesson order
- [ ] Rich text for readings (Markdown with a sanitiser); drag-and-drop reordering; video lesson re-upload
- [ ] Clean up storage for attachment uploads that were never recorded (presigned PUT without the complete call)
- [x] Library listing: `/courses` (My courses with All / In progress / Completed) and `/courses/:id` lesson list
- [x] Learner progress: streak, today's watch time, monthly activity calendar, resume card (`LearningDay` table)
- [x] Public landing page at `/` (animated, advertises a course, Enroll → sign-in). Copy is SAMPLE content in
      `apps/web/src/app/(marketing)/course.ts`
- [ ] Replace the sample landing copy with a real course, or render it from a published `Course` once course CRUD
      exists; add real (consented) student work or testimonials if the school has them
- [x] Light/dark theme switch (cookie, no flash) across landing, sign-in and app; light "product launch" landing theme
- [ ] Apply the same polish pass (motion tokens, skeleton loaders, empty-state illustrations) to the signed-in app
- [x] Parent view of a child's progress (2026-10-16): `/children`, read-only, per verified ParentLink; admins link
      parents on the Users page
- [ ] Self-service account deletion requests (the purge job exists; there's no request UI)
- [ ] Per-school daily watch goal (now a 30-min constant in `components/learner-progress.tsx`)
- [ ] "Questions attempted" on Today's progress once MCQ quizzes exist
- [ ] Course cover images (optional upload; `CourseTile` is the fallback)
- [x] Teacher attendance page with manual override (2026-10-16), and classes without Google (room or pasted link)
- [x] Assignments & MCQ quizzes (2026-10-16), with grades on the parent view
- [x] Gradebook per course and CSV grade reports (2026-10-16): `/courses/:id/grades`
- [ ] Rich text in assignment instructions; weighted grade categories; excusing a student from one piece of work
- [x] In-app notifications UI (2026-10-16): bell + `/notifications`
- [ ] Live notification count (SSE or polling), email digests, and deleting old read notifications
- [ ] Razorpay checkout + webhooks
- [ ] i18n (next-intl: en/hi/mr), PWA
