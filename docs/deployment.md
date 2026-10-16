# Deployment

How code gets from a PR to each environment, and how to roll back.

| Environment  | Where                                             | Status  | Guide                                                  |
| ------------ | ------------------------------------------------- | ------- | ------------------------------------------------------ |
| Landing page | Vercel, static files (`pnpm build:site`)          | Live    | [Static landing site](#static-landing-site-vercel-now) |
| **UAT**      | Home-lab Linux VM, Docker Compose (`deploy/uat/`) | Ready   | [uat.md](uat.md)                                       |
| Production   | AWS (Mumbai, `ap-south-1`)                        | Planned | [Production on AWS](#production-on-aws-plan)           |

```
PR ──► CI (ci.yml): checks · integration · e2e · docker · static site   ← required to merge
main ─► UAT VM pulls the commit once its checks are green → build → migrate → restart   (deploy/uat/auto-update.sh)
main ─► Vercel rebuilds the static landing page
```

The web and worker images (`apps/web/Dockerfile`, `apps/worker/Dockerfile`) are the deployable units everywhere:
UAT builds them on the VM, and production will run the same Dockerfiles on AWS. CI builds and smoke-tests both
on every PR.

## CI (`.github/workflows/ci.yml`)

| Job           | What                                                                                    | Services        |
| ------------- | --------------------------------------------------------------------------------------- | --------------- |
| `checks`      | format → lint → typecheck → unit tests                                                  | none            |
| `integration` | `prisma migrate deploy` from an empty DB → web + worker integration tests (real ffmpeg) | Postgres        |
| `e2e`         | migrate + seed → production build → Playwright (desktop + Pixel 7)                      | Postgres, Redis |
| `docker`      | build web and worker images, smoke-run them (ffmpeg present, non-root user)             | none            |

The env values in the workflow are throwaway CI values, not secrets. The Playwright report is uploaded as an
artifact when e2e fails. Reproduce any job locally with the same commands (README, "Scripts"). For e2e:
`pnpm db:seed && pnpm --filter @elearner/web build && pnpm test:e2e`.

## Static landing site (Vercel, now)

Until the full app is deployed, only the public landing page goes live, as plain static files. It uses the same
source as the app's `/` route, so there's nothing to keep in sync.

```bash
pnpm build:site            # → apps/web/out (≈1.2 MB): index.html, enroll/index.html, 404.html, _next/static
```

**How it works.**

- `STATIC_SITE=1` (`apps/web/next.config.ts`) switches Next to `output: "export"` and only routes named `*.site.tsx`:
  `layout.site.tsx`, `(marketing)/page.site.tsx` and `(marketing)/enroll/page.site.tsx`. The signed-in app, the API
  and the middleware are left out.
- The normal app build ignores `*.site.tsx`.

**Enrol links.**

- With no server, the static page can't tell who is signed in.
- Without `SITE_APP_URL`, "Enroll" and "Sign in" go to `/enroll/`, a page that says online enrolment opens soon.
- Once the full app is live, set `SITE_APP_URL=https://<app domain>` and redeploy. The buttons then go to
  `<app>/sign-in?next=/courses`.

**Deploy on Vercel (one time).**

1. Vercel → **Add New… → Project** → import `irfan199927/E-learning-website`.
2. Leave **Root Directory** as the repository root. The root `vercel.json` sets everything else: install with pnpm,
   build with `pnpm build:site`, output `apps/web/out`, no framework preset, security and cache headers. Don't
   override these in the dashboard.
3. **Environment variables:** none are needed. Optionally add `SITE_APP_URL` later (see above).
4. **Deploy.**
   - Vercel builds the **production branch** (`main` by default).
   - Until this work is merged, pick the `claude/serene-goldberg-jpzwca` branch for a preview, or merge first.
5. Optional: add your domain under **Settings → Domains**.

**Checks.**

- The `Static landing site` CI job runs the same build on every PR.
- To check locally: `cd apps/web/out && python3 -m http.server 4173`.

**Not on the static site:**

- the CSP nonce: only the app's middleware sets it (`vercel.json` adds the other security headers);
- server-rendered theme: a saved theme is re-applied after load, so a short flash is possible;
- sign-in itself.

The full app doesn't run on Vercel: it runs on the UAT VM now and on AWS later. Once an environment has a
public HTTPS address, set `SITE_APP_URL` on the static project so Enroll and Sign in go there.

## Production on AWS (plan)

Production will run the same images as UAT on AWS in **Mumbai (`ap-south-1`)**. That keeps students' data in
India (DPDP) and latency low. The mapping from the UAT stack:

| UAT (VM, Compose)          | Production (AWS)                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `web` container            | ECS on Fargate service, 2+ tasks, behind an Application Load Balancer with an ACM certificate |
| `worker` container         | ECS service on EC2 or Fargate with enough CPU for ffmpeg (start with 2 vCPU / 4 GB, 1 task)   |
| `postgres`                 | RDS for PostgreSQL 17, Multi-AZ, automated backups and point-in-time recovery                 |
| `redis`                    | ElastiCache (Redis OSS / Valkey) with parameter group `maxmemory-policy noeviction`           |
| `minio`                    | S3 bucket (private, block public access) + CloudFront for segments (fixes gap G2)             |
| `mailpit`                  | Amazon SES (SMTP credentials), with SPF/DKIM on the sending domain                            |
| `uat.env`                  | Secrets Manager / SSM Parameter Store, injected as task environment variables                 |
| `tools` image (migrations) | A one-off ECS task (`pnpm db:deploy`) that the deploy pipeline runs before rolling out        |
| Images built on the VM     | Built once in GitHub Actions, pushed to ECR, promoted unchanged from UAT to production        |

Still to decide when the AWS work starts, recorded as an ADR then:

- infrastructure as code (Terraform or CDK);
- how GitHub Actions authenticates to AWS (OIDC role, no long-lived keys);
- whether UAT also moves to AWS or stays on the VM.

`.github/workflows/deploy.yml` still contains the earlier Vercel and Render jobs. They stay **off**, because the
repo variable `DEPLOY_ENABLED` isn't set, and will be replaced by the AWS pipeline. Keep these from the old plan:

- the protected `production` environment with an approval before migrations;
- migrations before rollout;
- one deploy at a time.

**Branch protection** applies now, whatever the hosting. In GitHub → Settings → Branches, protect `main`: require a
PR and require the CI checks `Format, lint, typecheck, unit tests`, `Integration tests (Postgres, ffmpeg)`,
`Build + Playwright e2e`, `Docker images (web)`, `Docker images (worker)` and `Static landing site`. UAT only deploys
green commits, but protection stops a red one from landing on `main` at all.

## Releasing

Merge to `main`. CI runs on the merge commit, and as soon as every check is green the UAT VM deploys it, with
migrations first (see [uat.md](uat.md)). Production releases on AWS will add an approval step.

**Migrations must be backward compatible.** The old version keeps serving while the new one rolls out, and
on rollback. Use expand → deploy → contract:

1. Add the new column or table as nullable, or with a default.
2. Ship the code that uses it.
3. Drop the old one in a later release.

Never edit a migration that has been deployed. Add a new one.

## Rollback

- **UAT:** check out the previous commit on the VM and run `deploy/uat/deploy.sh` (uat.md → Roll back).
- **Static landing page:** Vercel → Deployments → previous deployment → _Promote_.
- **Database:** roll forward with a new migration that reverses the change. Restore a backup only for data loss
  (`deploy/uat/manage.sh backup` on UAT; RDS point-in-time recovery in production).

## Building images locally

```bash
docker build -f apps/web/Dockerfile -t elearner-web .        # from the repo root
docker build -f apps/worker/Dockerfile -t elearner-worker .
docker run --rm --network host --env-file .env -e NODE_ENV=production elearner-web
```

The images take all config from environment variables, and none are needed at build time. Both run as the
non-root `node` user and have a `HEALTHCHECK` (web: `/api/health`, worker: `/healthz`). Orchestrators should
use `/api/health/ready` (database + Redis) for readiness. The Dockerfiles take a `NODE_IMAGE` build arg, for
a mirrored or patched base image.
