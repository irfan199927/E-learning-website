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
