# Next steps (handoff)

Ordered by priority. Each item is self-contained enough to hand to Claude Code as one task.

## 1. Finish the quality gate (small)

- [x] `pnpm lint` and `pnpm format:check` pass (enforced by pre-commit hooks).
- [ ] Re-check the calendar toolbar styling after the CSP `font-src data:` fix (prev/next icons should now render).

## 2. Delivery (needed before first deploy)

- [ ] `apps/web/Dockerfile` (Next `output: "standalone"`) and `apps/worker/Dockerfile` (node:22-slim + ffmpeg, non-root user, `pnpm deploy`).
- [ ] `.github/workflows/ci.yml`: format → lint → typecheck → unit → integration (postgres+redis service containers,
      `prisma migrate deploy`) → build → Playwright e2e (set `AUTH_SIGNIN_LIMIT_PER_MIN=100`).
- [ ] `.github/workflows/deploy.yml`: on main → `pnpm db:deploy` (prod) → deploy web (Vercel) + worker (Render/Fly), gated by environment approval.
- [ ] Dependabot/Renovate, CODEOWNERS, PR template, commitlint already configured in package.json.

## 3. Documentation set (user asked for proper docs)

- [ ] `README.md` (overview, quickstart, repo map, scripts)
- [ ] `CONTRIBUTING.md` (branching, conventional commits, PR checklist, definition of done)
- [ ] `SECURITY.md` + `docs/security.md` (threat model, controls, DPDP handling)
- [ ] `docs/architecture.md` (container view + sequence diagrams: scheduling, recording sync, upload, playback)
- [ ] `docs/adr/0001…0007` — monorepo; route handlers + worker vs NestJS; Better Auth + DB sessions; Prisma 7;
      R2 + gated HLS playlists; separate Google API grant (Internal OAuth app); recurring classes as Google instances
- [ ] `docs/environment.md` (every env var — source of truth is apps/web/src/env.ts + apps/worker/src/env.ts)
- [ ] `docs/google-setup.md` (GCP project, Internal consent screen, scopes, Workspace recording policy)
- [ ] `docs/deployment.md` (Vercel, Render, Neon, Redis w/ `noeviction`, R2 bucket + CORS exposing `ETag`)
- [ ] `docs/testing.md`, `docs/api.md` (+ OpenAPI), runbooks: recording-sync, transcode-failures, google-reconnect,
      restore-database, rotate-secrets, incident-response

## 4. Product (MVP backlog from docs/SPEC.md)

- [ ] Admin: user CSV import, enrollments, parental-consent flow (DPDP) UI
- [ ] Courses/modules/lessons CRUD + attachments; library listing page
- [ ] Assignments & MCQ quizzes; teacher attendance page with manual override
- [ ] In-app notifications UI; Razorpay checkout + webhooks
- [ ] i18n (next-intl: en/hi/mr), PWA
