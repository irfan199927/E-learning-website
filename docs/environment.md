# Environment variables

Every setting the apps read. The source of truth is the zod schema in each app:

- web: `apps/web/src/env.ts`
- worker: `apps/worker/src/env.ts`

If this page and the schema disagree, the schema wins. Fix this page.

Both apps validate their settings and refuse to run with a missing or malformed value. The error lists every
problem and points here.

- The **worker** checks at boot.
- The **web app** checks on the first request (or the readiness probe), so `next build` needs no secrets.

Locally, copy `.env.example` to `.env` at the repository root. Everything in it works with `pnpm infra:up` except
the Google credentials (see [google-setup.md](google-setup.md)). In production, set the variables on each service
([uat.md](uat.md) for the UAT VM; AWS later, see [deployment.md](deployment.md)).

**Never commit `.env`.** It is gitignored, and only `.env.example` (no real secrets) is tracked.

## Shared by web and worker

Where a variable is used by both, set the **same value** on both services. Pay special attention to
`TOKEN_ENC_KEYS`: the web app stores the tokens and the worker decrypts them.

| Variable                  | Required | Default       | What it is                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | -------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                | no       | `development` | `development`, `test` or `production`.                                                                                                                                                                                                                                                                                     |
| `LOG_LEVEL`               | no       | `info`        | pino level: `fatal` … `trace`. Use `debug` locally, `info` in production.                                                                                                                                                                                                                                                  |
| `APP_URL`                 | yes      |               | Public origin of the web app, e.g. `https://learn.school.edu`. Better Auth's base URL and only trusted origin, the same-origin check on API writes, the Google OAuth redirect (`/api/v1/google/callback`) and links in emails. Must match the browser's origin exactly (see below).                                        |
| `DATABASE_URL`            | yes      |               | Postgres connection string. In production, the **pooled** Neon URL. Migrations use a separate direct URL (`DATABASE_DIRECT_URL` secret in deploy.yml).                                                                                                                                                                     |
| `REDIS_URL`               | yes      |               | Redis for BullMQ queues and rate limiting. The server must use `maxmemory-policy noeviction`, or queued jobs can be dropped.                                                                                                                                                                                               |
| `GOOGLE_CLIENT_ID`        | no       | empty         | OAuth client of the Google Cloud project. **Leave it and the secret empty to run without Google** (e.g. the LAN-only UAT): the Google button is hidden and teachers can't connect Meet.                                                                                                                                    |
| `GOOGLE_CLIENT_SECRET`    | no       | empty         | Its secret.                                                                                                                                                                                                                                                                                                                |
| `GOOGLE_WORKSPACE_DOMAIN` | no       |               | Set it to the school's Workspace domain (e.g. `school.edu`) to accept only that domain: Google sign-in checks the `hd` claim and the email, and the teacher API grant asks for that domain. **Leave it unset for open sign-up**, where any Google account can create a student account and teachers approve course access. |
| `TOKEN_ENC_KEYS`          | yes      |               | Keyring for encrypting stored Google tokens (AES-256-GCM): `<id>:<base64 32-byte key>`, comma-separated, e.g. `v1:…=,v2:…=`. Ids must not contain `.`.                                                                                                                                                                     |
| `TOKEN_ENC_ACTIVE_KEY_ID` | yes      |               | Which key in the ring encrypts new values, e.g. `v2`. Must be present in `TOKEN_ENC_KEYS`.                                                                                                                                                                                                                                 |
| `S3_ENDPOINT`             | yes      |               | S3-compatible endpoint: `https://<account>.r2.cloudflarestorage.com` (R2) or `http://localhost:9000` (MinIO). Its origin is also added to the CSP so browsers can upload and stream directly.                                                                                                                              |
| `S3_REGION`               | no       | `auto`        | `auto` for R2.                                                                                                                                                                                                                                                                                                             |
| `S3_BUCKET`               | yes      |               | Private bucket for uploads, HLS segments and recordings.                                                                                                                                                                                                                                                                   |
| `S3_ACCESS_KEY_ID`        | yes      |               | Bucket-scoped access key.                                                                                                                                                                                                                                                                                                  |
| `S3_SECRET_ACCESS_KEY`    | yes      |               | Its secret.                                                                                                                                                                                                                                                                                                                |
| `S3_FORCE_PATH_STYLE`     | no       | `false`       | `true` for MinIO; `false` for R2.                                                                                                                                                                                                                                                                                          |
| `SMTP_URL`                | yes      |               | e.g. `smtps://user:pass@smtp.example.com:465`. Locally `smtp://localhost:1025` (Mailpit, inbox at http://localhost:8025).                                                                                                                                                                                                  |
| `MAIL_FROM`               | yes      |               | Sender, e.g. `"E-learner <no-reply@school.edu>"`. The domain needs SPF/DKIM for the mail provider.                                                                                                                                                                                                                         |

## Web only

| Variable                    | Required | Default             | What it is                                                                                                                                                                                                                 |
| --------------------------- | -------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`        | yes      |                     | At least 32 characters; signs session cookies. Generate with `openssl rand -base64 32`. Changing it signs everyone out.                                                                                                    |
| `MAX_UPLOAD_BYTES`          | no       | `4294967296` (4 GB) | Largest video a teacher may upload. The upload page shows it in GB.                                                                                                                                                        |
| `JOIN_OPENS_MINUTES_BEFORE` | no       | `10`                | How many minutes before a class the Join button becomes active (0–60).                                                                                                                                                     |
| `CLIENT_IP_HEADER`          | no       | (empty)             | Header your reverse proxy sets to the real client IP (`cf-connecting-ip` behind Cloudflare, `x-real-ip` behind nginx). Empty = `x-forwarded-for`, which clients can fake when no proxy overwrites it. Used by rate limits. |
| `AUTH_SIGNIN_LIMIT_PER_MIN` | no       | `5`                 | Email sign-in attempts per minute per IP. **Leave unset in production.** Playwright raises it to 100 because every e2e test signs in from the same address.                                                                |
| `APP_VERSION`               | no       | `dev`               | Reported by `GET /api/health`. Set it to the commit SHA at deploy time if you want to see which build is serving.                                                                                                          |

## Worker only

| Variable                   | Required | Default   | What it is                                                                                                                |
| -------------------------- | -------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| `ATTENDANCE_PRESENT_RATIO` | no       | `0.5`     | Share of the class time (0–1) a student must spend in the Meet to be marked present. A teacher's manual mark always wins. |
| `WORKER_HEALTH_PORT`       | no       | `8080`    | Port of the worker's health endpoint (Docker `HEALTHCHECK`, Render health check).                                         |
| `TRANSCODE_CONCURRENCY`    | no       | `1`       | Parallel ffmpeg transcodes (1–8). Transcodes are CPU-heavy; raise this only with the instance size.                       |
| `FFMPEG_PATH`              | no       | `ffmpeg`  | Path to the ffmpeg binary. The worker image installs it on `PATH`.                                                        |
| `FFPROBE_PATH`             | no       | `ffprobe` | Path to ffprobe.                                                                                                          |

## Build time only

Not read at runtime. Set them in the environment of the build.

| Variable       | Where                 | What it is                                                                                                                                                                                                  |
| -------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STATIC_SITE`  | `pnpm build:site`     | Set to `1` by the script. Builds only the static landing page (`*.site.tsx` routes) into `apps/web/out`. Don't set it by hand.                                                                              |
| `SITE_APP_URL` | static Vercel project | Origin of the deployed full app. When set, the static page's Enroll and Sign in buttons go to `<SITE_APP_URL>/sign-in`. When unset, they go to the "enrolment opens soon" page. Redeploy after changing it. |

## Not read yet

- `SENTRY_DSN` is in `.env.example` as a placeholder for error reporting. No code reads it yet, so setting it
  does nothing.

## GitHub Actions settings

These are set in the repository settings for `deploy.yml`, not on the services. See
[deployment.md](deployment.md) → One-time setup.

| Name                                 | Kind                              | Purpose                                                                                                            |
| ------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `DEPLOY_ENABLED`                     | repository variable               | `true` turns the deploy jobs on. Until then, merges to `main` only run CI.                                         |
| `WORKER_ENABLED`                     | repository variable               | Part of the earlier Vercel/Render jobs in deploy.yml, which stay off (`DEPLOY_ENABLED` unset). UAT doesn't use it. |
| `APP_URL`                            | `production` environment variable | URL shown on the GitHub deployment.                                                                                |
| `DATABASE_DIRECT_URL`                | `production` environment secret   | Direct (non-pooled) Postgres URL for `prisma migrate deploy`.                                                      |
| `VERCEL_TOKEN`                       | `production` environment secret   | Deploys the web app.                                                                                               |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `production` environment secrets  | Which Vercel project to deploy.                                                                                    |
| `RENDER_WORKER_DEPLOY_HOOK_URL`      | `production` environment secret   | Render deploy hook for the worker.                                                                                 |

CI itself (`ci.yml`) uses fixed throwaway values for every runtime variable and needs no secrets.

## Common tasks

### Generate secrets

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET, or one TOKEN_ENC_KEYS key
```

### Rotate the token encryption key

Stored Google tokens record which key encrypted them, so rotation needs no downtime or migration.

1. Generate a new key and **add** it to the ring on both services: `TOKEN_ENC_KEYS=v1:<old>,v2:<new>`.
2. Set `TOKEN_ENC_ACTIVE_KEY_ID=v2` on both services and redeploy both.
3. New tokens are now written with `v2`. Old rows are re-encrypted with `v2` the next time they are read.
4. Keep `v1` in the ring until no row still uses it. It is only safe to remove after every teacher's token has
   been read at least once since step 2.

Removing a key that rows still use makes those teachers reconnect Google. Nothing else is lost.

### "Confirm your email first" on sign-in, or 403 from `/api/auth/*`

`APP_URL` doesn't match the origin in the browser's address bar. Check the scheme, host and port:
`http://localhost:3000` and `http://127.0.0.1:3000` are different origins. Playwright runs on
`http://localhost:3100` and sets `APP_URL` to match.

### Google Calendar push notifications don't arrive locally

Calendar sends push notifications only to a public HTTPS `APP_URL`, so with `http://localhost` the watch channel is
not registered. Classes scheduled through the app still work. Edits made directly in Google Calendar are not synced
back until the app runs on HTTPS.
