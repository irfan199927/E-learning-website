# UAT on a home-lab VM

User acceptance testing runs the **full app** on one Linux VM in your network:

- the web app and the worker;
- Postgres, Redis and S3-compatible storage (MinIO);
- a mail inbox for UAT emails (Mailpit).

It uses the same Docker images that production on AWS will use later.

```
LAN browser ──► VM :80   web (Next.js)  ──► postgres · redis (internal only)
            └─► VM :9000 MinIO  (uploads and video segments, by presigned URL)
            └─► VM :8025 Mailpit (every email the app sends lands here)
                   worker (reminders, transcoding, recording sync) ──► same services
```

Everything is defined in `deploy/uat/`. Settings and secrets live **on the VM only**, in
`/opt/elearner/uat.env`.

## What works on a LAN-only UAT

- **Password sign-in** for accounts you create (see [First users](#first-users)), "Forgot password", and all
  emails, which you can read in the Mailpit inbox.
- Teachers creating courses, join requests and approvals, uploading videos, transcoding, the player, progress
  and the calendar view.
- Scheduling classes in a room or on any meeting link you paste (Zoom, Teams, Jitsi…), and taking attendance by
  hand; parents see the marks.

What doesn't:

- **Google sign-in, Google Meet classes and their automatic recordings and attendance.** Google only accepts a public HTTPS address (or `localhost`)
  as a sign-in redirect, so the Google button is hidden while `GOOGLE_CLIENT_ID` is empty. When you have a domain,
  see [Later: a public HTTPS address](#later-a-public-https-address).

## The VM

- Ubuntu 24.04 or Debian 12, x86_64.
- **4 vCPU, 8 GB RAM, 100 GB disk** is comfortable. Video transcoding is the heavy part; 2 vCPU and 4 GB work
  for light testing.
- A **fixed LAN IP** (a DHCP reservation on your router) or a hostname your LAN resolves, e.g. `192.168.1.50`.

## Setup (once)

On the VM, as a user with sudo:

```bash
curl -fsSL https://raw.githubusercontent.com/irfan199927/E-learning-website/main/deploy/uat/bootstrap-vm.sh -o bootstrap.sh
less bootstrap.sh                      # read what it does first
sudo bash bootstrap.sh 192.168.1.50    # your VM's LAN IP or hostname
```

`bootstrap-vm.sh`:

1. installs Docker Engine and Compose from Docker's own repository, plus `git`, `jq` and `openssl`;
2. creates a system user `elearner` (home `/opt/elearner`) in the `docker` group;
3. clones the repository to `/opt/elearner/app`;
4. writes `/opt/elearner/uat.env` with fresh random secrets (`deploy/uat/init-env.sh`, mode 600);
5. installs and starts the `elearner-uat-update.timer` systemd timer.

Within 2 minutes the timer starts the first deploy. Building the images takes about 10 minutes the first time;
later builds reuse the cache. Follow it with:

```bash
journalctl -fu elearner-uat-update
```

When it prints `UAT is up`, open `http://192.168.1.50` from any device on your LAN.

## How updates arrive (automatic)

Every 2 minutes the timer runs `deploy/uat/auto-update.sh`:

1. `git fetch` `main`. If the newest commit is the one already deployed, it stops.
2. It asks GitHub's public API whether **every check on that commit passed**. While CI is still running it waits
   and tries again next time. If CI failed, it doesn't deploy.
3. It checks out the commit and runs `deploy/uat/deploy.sh`:
   - builds the images;
   - starts Postgres, Redis, MinIO and Mailpit;
   - applies **database migrations** (`pnpm db:deploy` in the tools image);
   - restarts web and worker;
   - waits until `/api/health/ready` reports the database and Redis as OK.

So **merging a PR to `main` updates UAT within a few minutes of CI turning green.** Nothing on the internet
connects to your network: the VM only makes outgoing requests to GitHub. Only code that is on `main` and passed CI
ever runs on the VM.

> The repository is public. That's why this setup doesn't use a self-hosted GitHub Actions runner: a runner on a
> public repo can be made to run code from a stranger's pull request inside your home network.

To deploy by hand, for example right after changing `uat.env`:

```bash
sudo -iu elearner
cd app && deploy/uat/deploy.sh
```

## First users

Without Google, people sign in with a password. Create **the first admin** (you) on the VM:

```bash
sudo -iu elearner
cd app
deploy/uat/manage.sh create-user you@example.com "Your Name" ADMIN
```

It prints a **temporary password** once. Sign in at `http://192.168.1.50`, then change it with **Forgot
password**. The email appears in the UAT inbox at `http://192.168.1.50:8025`.

Add everyone else from the app: **Users → Add people**, one at a time or from a spreadsheet (CSV). Each person
gets a "choose a password" email. On UAT that email lands in the inbox at `:8025`, so open it there and pass the
link on, or set `SMTP_URL` in `uat.env` to send real email.

Students then ask to join a teacher's course from **My courses → Find a course**, and the teacher approves the
request on the course page.

Other tasks:

| Command (as `elearner`, in `/opt/elearner/app`)     | What it does                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `deploy/uat/manage.sh set-role email@x.com TEACHER` | Change someone's role                                                                    |
| `deploy/uat/manage.sh demo-data`                    | Add the demo accounts and course from the seed (`*@school.edu`, password `Password123!`) |
| `deploy/uat/manage.sh status`                       | Show the containers and their health                                                     |
| `deploy/uat/manage.sh logs web` / `logs worker`     | Follow the logs                                                                          |
| `deploy/uat/manage.sh backup`                       | Database dump to `/opt/elearner/backups/elearner-<date>.sql.gz`                          |

## Settings (`/opt/elearner/uat.env`)

| Variable                                                                           | Meaning                                                                                               |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `UAT_HOST`                                                                         | The VM's LAN IP or hostname. Browsers reach MinIO at `http://UAT_HOST:9000`.                          |
| `APP_URL`                                                                          | The address people type, e.g. `http://192.168.1.50`. Must match exactly, or sign-in fails.            |
| `WEB_PORT`                                                                         | Port for the web app (default 80). If you change it, add it to `APP_URL` too.                         |
| `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, `BETTER_AUTH_SECRET`, `TOKEN_ENC_KEYS` | Generated secrets. Don't change them once data exists: the database and stored tokens depend on them. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                         | Empty = no Google features. See below.                                                                |
| `SMTP_URL`, `MAIL_FROM`                                                            | Unset = all mail goes to the UAT inbox. Set `SMTP_URL` to send real email.                            |
| `TRANSCODE_CONCURRENCY`                                                            | Parallel video transcodes (default 1). Raise only with more CPUs.                                     |

Everything else (database and Redis addresses, bucket name and so on) is fixed in `deploy/uat/compose.yaml`.
After editing the file, run `deploy/uat/deploy.sh` to apply it.

## Data and backups

- Data lives in Docker volumes: `elearner-uat_pgdata`, `elearner-uat_redisdata` and `elearner-uat_miniodata`.
  Redeploys keep them.
- Run `manage.sh backup` before risky changes. To back up every night, add a cron entry for `elearner`:
  `15 2 * * * /opt/elearner/app/deploy/uat/manage.sh backup`.
- Back up `/opt/elearner/uat.env` somewhere safe. Without it, stored Google tokens can't be decrypted and
  everyone is signed out.
- To restore a dump:

  ```bash
  gunzip -c backup.sql.gz | docker compose -f deploy/uat/compose.yaml exec -T postgres psql -U elearner elearner
  ```

## Roll back

```bash
sudo -iu elearner && cd app
git checkout <older commit> && deploy/uat/deploy.sh
```

The timer deploys `main` again as soon as a newer green commit lands. To pause automatic updates:
`sudo systemctl stop elearner-uat-update.timer` (and `start` to resume).

Migrations are only ever added, never edited (see deployment.md), so an older app version keeps working against
a newer schema.

## Security notes

- Ports 80, 9000 and 8025 are open **to your LAN** only. Don't forward them on your router.
- Postgres and Redis aren't published at all. The MinIO console listens on the VM itself only
  (`ssh -L 9001:127.0.0.1:9001 vm` to open it).
- UAT uses plain HTTP, so anyone on the same network could read the traffic. Use test data, not real student
  records.
- The Mailpit inbox shows every email, including password-reset links, to anyone on the LAN. That's fine for
  UAT; production uses a real mail provider.

## Later: a public HTTPS address

When you have a domain, put the VM behind **Cloudflare Tunnel**. You don't need to open any ports.

1. Add the tunnel as an extra Compose file (`UAT_COMPOSE_OVERRIDE`) with a `cloudflared` service that routes
   `uat.yourdomain.com` to `web:3000` and `files.uat.yourdomain.com` to `minio:9000`.
2. In `uat.env`, set `APP_URL=https://uat.yourdomain.com`. The S3 endpoint then needs the public files host; this
   is a small `compose.yaml` change at that point.
3. Create the Google OAuth client ([google-setup.md](google-setup.md), "Open sign-up"). Fill in
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then redeploy. The Google button appears.

With an HTTPS `APP_URL`, the app also switches on its HTTPS-only protections: secure cookies and the CSP's
`upgrade-insecure-requests`.

## Troubleshooting

| Symptom                                                       | Fix                                                                                                 |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Sign-in says "Confirm your email first", or API calls get 403 | The address in the browser isn't exactly `APP_URL`. Use the same IP or hostname, and the same port. |
| Uploads stall at 0% or videos don't play                      | The browser can't reach `http://UAT_HOST:9000`. Check `UAT_HOST` and that nothing blocks port 9000. |
| Deploy log says `CI not finished` for a long time             | Check the commit's checks on GitHub. The timer retries every 2 minutes.                             |
| `CI failed, not deploying`                                    | Expected: fix `main` first. UAT keeps running the last good version.                                |
| Readiness check failed                                        | `deploy/uat/manage.sh logs web`. The usual cause is a typo in `uat.env`.                            |
