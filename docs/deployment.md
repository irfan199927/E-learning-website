# Deployment

How code gets from a PR to production, what to set up once, and how to roll back.

```
PR ──► CI (ci.yml): checks · integration · e2e · docker      ← required to merge
main ─► Deploy (deploy.yml): CI again ─► [approval] migrate ─► web → Vercel
                                                         └─► worker image → GHCR → Render
```

| Piece    | Runs on                                                                 | Built from                                               |
| -------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| Web      | Vercel (Next.js)                                                        | `apps/web`, by `vercel build` in deploy.yml              |
| Worker   | Render, Background Worker, image-backed                                 | `apps/worker/Dockerfile` → `ghcr.io/<repo>/worker:<sha>` |
| Postgres | Neon (pooled URL for apps, direct for migrations)                       | `packages/db/prisma/migrations`                          |
| Redis    | A managed Redis with `maxmemory-policy noeviction` (BullMQ requirement) | none                                                     |
| Storage  | Cloudflare R2                                                           | none                                                     |

`apps/web/Dockerfile` also builds a self-contained web image (Next standalone) for hosts other than Vercel,
or for staging. CI builds both images on every PR to make sure they still work.

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

When the full app goes live it's a **separate** Vercel project with Root Directory `apps/web` (see one-time setup
below). That project doesn't read the repository-root `vercel.json`.

## Free-tier setup (web only, no worker)

The cheapest way to put the full app online. It runs everything except the background worker.

**What works:**

- Google sign-up for anyone;
- teachers create courses and approve join requests;
- students browse courses, ask to join, and open the courses they're approved for;
- the calendar and class schedule;
- scheduling classes on Google Meet, for teachers who connect Google.

**What waits for the worker:**

- class reminders;
- importing Meet recordings and attendance;
- video transcoding (uploads stay "Queued for processing");
- scheduled cleanup.

Add the worker later with _One-time setup_ steps 5 and 6 and the repo variable `WORKER_ENABLED=true`.

| Piece    | Service (free plan)                                  | Region                                         |
| -------- | ---------------------------------------------------- | ---------------------------------------------- |
| Web      | Vercel Hobby, a **second** project (Root `apps/web`) | Mumbai (`bom1`, set in `apps/web/vercel.json`) |
| Postgres | Neon Free                                            | Mumbai if offered, else Singapore              |
| Redis    | Upstash Redis Free (rate limits and queued jobs)     | Mumbai or Singapore                            |
| Storage  | Cloudflare R2 (10 GB free; needs a card on file)     | Location hint: Asia-Pacific                    |
| Email    | Brevo Free SMTP (300 emails a day)                   | none                                           |

Collect each value below as you go. Don't paste secrets into chats, issues or PRs. They only go into Vercel
and GitHub settings.

1. **Neon:** create a project.
   - From **Connection details**, copy the **pooled** URL (host contains `-pooler`); this is `DATABASE_URL`.
   - Turn pooling off and copy the URL again; this is the direct URL for migrations, `DATABASE_DIRECT_URL`.
2. **Upstash:** create a Redis database with **eviction off**. Copy the `rediss://…` URL; this is `REDIS_URL`.
3. **Cloudflare R2:** create a private bucket, e.g. `elearner-media`.
   - From **Manage API tokens**, create an Object Read & Write token for that bucket. It gives you
     `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`.
   - The endpoint is `https://<account id>.r2.cloudflarestorage.com` (`S3_ENDPOINT`). Set `S3_REGION=auto` and
     `S3_FORCE_PATH_STYLE=false`.
   - Add a CORS rule: allow `PUT` and `GET` from your app URL, allow the `content-type` header, and **expose
     `ETag`**.
4. **Brevo:** add and verify the sender address.
   - Under **SMTP & API → SMTP**, create an SMTP key.
   - `SMTP_URL=smtp://<login>:<smtp key>@smtp-relay.brevo.com:587`
   - `MAIL_FROM="E-learner <the verified address>"`
5. **Vercel, the app project:**
   - **Add New → Project**, import the same repository again, and set **Root Directory `apps/web`**.
     `apps/web/vercel.json` sets the build, the region, and turns off Git auto-deploys, because deploy.yml deploys
     after CI.
   - Note the project's `*.vercel.app` address. That's `APP_URL`, e.g. `https://e-learner-app.vercel.app`.
   - Under **Settings → Environment Variables (Production)**, add:
     - `APP_URL`, `DATABASE_URL` (pooled) and `REDIS_URL`;
     - `BETTER_AUTH_SECRET` (`openssl rand -base64 32`);
     - `TOKEN_ENC_KEYS=v1:<openssl rand -base64 32>` and `TOKEN_ENC_ACTIVE_KEY_ID=v1`;
     - the five `S3_*` values, `SMTP_URL` and `MAIL_FROM`;
     - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (step 6).

     Leave `GOOGLE_WORKSPACE_DOMAIN` unset, so any Google account can sign up. See
     [environment.md](environment.md).

   - **Account Settings → Tokens:** create a token (`VERCEL_TOKEN`). The project's **Settings → General** shows
     the Project ID, and your team settings show the Team ID (`VERCEL_ORG_ID`).

6. **Google:** follow [google-setup.md](google-setup.md) **"Open sign-up"**. The redirect URIs use your
   `APP_URL`.
7. **GitHub → Settings → Environments → New environment `production`:**
   - Add the secrets `DATABASE_DIRECT_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.
   - Add the environment variable `APP_URL`.
   - Required reviewers are optional when you're the only maintainer.
8. **GitHub → Settings → Secrets and variables → Actions → Variables:** add `DEPLOY_ENABLED=true`. Leave
   `WORKER_ENABLED` unset.
9. **Deploy:** open **Actions → Deploy → Run workflow** on `main`. It runs CI, applies the migrations to Neon, and
   deploys the web app.
10. **Make yourself admin:**
    1. Open `APP_URL` and sign in with Google. You're a student at first.
    2. Run **Actions → "Admin: set user role"** with your email and `ADMIN`.
    3. Do the same with `TEACHER` for each teacher after they've signed in once.
11. **Point the landing page at the app:** in the _static_ Vercel project, set `SITE_APP_URL` to `APP_URL` and
    redeploy. Its Enroll and Sign in buttons then open the real sign-in.

**Check it:**

- `APP_URL/api/health/ready` returns `{"status":"ok","checks":{"database":"ok","redis":"ok"}}`.
- In a private window, sign up with a second Google account and ask to join a course. Then, as the teacher,
  approve it under the course's **Join requests**.

## One-time setup

1. **GitHub → Settings → Branches:** protect `main`. Require a PR and require the checks
   `Format, lint, typecheck, unit tests`, `Integration tests (Postgres, ffmpeg)`, `Build + Playwright e2e`,
   `Docker images (web)` and `Docker images (worker)`.
2. **GitHub → Settings → Environments → `production`:**
   - Add required reviewers. This is the approval gate before migrations run.
   - Restrict deployment branches to `main`.
   - Add these **environment secrets**:

   | Secret                               | Value                                                          |
   | ------------------------------------ | -------------------------------------------------------------- |
   | `DATABASE_DIRECT_URL`                | Neon **direct** (non-pooled) connection string, for migrations |
   | `VERCEL_TOKEN`                       | Vercel access token scoped to the team                         |
   | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` in `apps/web`  |
   | `RENDER_WORKER_DEPLOY_HOOK_URL`      | Render → worker service → Settings → Deploy Hook               |
   - Add the **environment variable** `APP_URL` (the public URL shown on the deployment).

3. **GitHub → Settings → Variables (repository):** set `DEPLOY_ENABLED=true` once steps 4–6 are done. Until
   then the deploy jobs are skipped and only CI runs.
4. **Vercel project:**
   - Root Directory `apps/web`, framework Next.js. Install command `pnpm install --frozen-lockfile`.
   - Set every variable from `apps/web/src/env.ts` for Production: the pooled Neon `DATABASE_URL`,
     `REDIS_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_*`, `TOKEN_ENC_*`, `S3_*`, `SMTP_URL`, `MAIL_FROM`,
     `APP_URL`.
   - Leave `AUTH_SIGNIN_LIMIT_PER_MIN` unset (default 5).
   - Turn off Vercel's own Git auto-deploys. deploy.yml deploys only after CI and approval.
5. **Render:**
   - Create a Background Worker from an existing image: `ghcr.io/<owner>/<repo>/worker:<any sha>`.
   - If the GHCR package is private, add registry credentials (a GitHub PAT with `read:packages`).
   - Set every variable from `apps/worker/src/env.ts`, with the same values as the web app where they
     overlap (`TOKEN_ENC_KEYS` must match).
6. **R2 bucket:**
   - CORS allows `PUT` from `APP_URL` and **exposes the `ETag` header**. Multipart upload completion needs it.
   - The bucket is private (segments are served through presigned URLs only).

## Releasing

Merge to `main` → Deploy runs CI → a reviewer approves `production` → migrations → web and worker deploy in
parallel. A deploy never cancels another one half-way (concurrency group `deploy-production`).

**Migrations must be backward compatible.** The old version keeps serving while the new one rolls out, and
on rollback. Use expand → deploy → contract:

1. Add the new column or table as nullable, or with a default.
2. Ship the code that uses it.
3. Drop the old one in a later release.

Never edit a migration that has been deployed. Add a new one.

## Rollback

- **Web:** Vercel → Deployments → previous production deployment → _Promote_ (instant).
- **Worker:** Render → Manual Deploy → pick the previous image tag (`worker:<previous sha>`). Images are kept in
  GHCR.
- **Database:** roll forward with a new migration that reverses the change. Restore from Neon point-in-time
  recovery only for data loss (runbook: `restore-database`, see NEXT_STEPS).

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
