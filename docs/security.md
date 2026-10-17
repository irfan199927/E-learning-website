# Security

How E-learner protects its users, most of whom are children. This page covers the threat model, the controls in
the code (with file references), how personal data is handled under India's DPDP Act 2023, and what is still
missing.

To report a vulnerability, see [SECURITY.md](../SECURITY.md). Spec background: [SPEC.md](SPEC.md) §4.

> Status as of 2026-10-16. **Built** means the control is in the code and tested. **Planned** means it is
> designed but not built yet. Don't treat a planned control as protection.

## What we protect

| Asset                                  | Why it matters                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Student personal data                  | Students' names, emails, attendance, grades, progress (all students are 18+).  |
| Class recordings and uploaded videos   | Show children's faces and voices. Must only reach enrolled students and staff. |
| Teachers' Google tokens                | Give access to a teacher's Calendar, Meet records and Drive recordings.        |
| Sessions and passwords                 | Account takeover of a teacher or admin exposes a whole class or school.        |
| Production secrets and the deploy path | Whoever controls them controls everything above.                               |

## Actors and trust boundaries

- **Anonymous visitors** can reach only the landing page, sign-in, password reset and `/api/health`. Accounts
  sign up with Google (or are created by admins) and start with no course access.
- **Students, parents, teachers and admins** are authenticated. The role comes from the database on every
  request, never from the client.
- **Google** calls one public endpoint: the Calendar push webhook, which is authenticated by a per-channel
  secret.
- **The worker** has no public endpoints except a health check. It takes jobs only from Redis.
- **Browsers talk to object storage directly**, but only with short-lived presigned URLs that the web app issues
  after an access check.

## Threat model

| #   | Threat                                                      | Controls                                                                                                                                                                                                                                | Status                                         |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| T1  | Credential stuffing or password guessing                    | Sign-in limited to 5/min/IP; passwords at least 10 characters; email verification required                                                                                                                                              | Built                                          |
| T2  | Stolen session used after the user is removed               | Database sessions checked on every request, no cookie cache; password reset revokes all sessions                                                                                                                                        | Built                                          |
| T3  | Strangers sign up and reach course content                  | Google sign-up creates a student with **no courses**; content needs an enrolment, which only the course teacher or an admin grants by approving a join request. With `GOOGLE_WORKSPACE_DOMAIN` set, only that domain can sign in at all | Built                                          |
| T4  | Student reads another course's videos, classes or progress  | `assertCan()` role checks plus resource policies (`server/policies.ts`); enrollment is the gate                                                                                                                                         | Built                                          |
| T5  | Probing ids to discover what exists                         | Resources you can't access return 404 NOT_FOUND, the same as missing ones                                                                                                                                                               | Built                                          |
| T6  | Sharing a video link outside the school                     | Private bucket; segment URLs are presigned per viewer and expire                                                                                                                                                                        | Built                                          |
| T7  | Cross-site request forgery                                  | `SameSite=Lax` cookies; API writes require a same-origin `Origin` header                                                                                                                                                                | Built                                          |
| T8  | Cross-site scripting                                        | React escaping; per-request nonce CSP with `strict-dynamic`, no inline scripts                                                                                                                                                          | Built                                          |
| T9  | Clickjacking                                                | `frame-ancestors 'none'` and `X-Frame-Options: DENY`                                                                                                                                                                                    | Built                                          |
| T10 | Database leak exposes Google tokens                         | Tokens encrypted with AES-256-GCM under a key that lives only in the environment                                                                                                                                                        | Built                                          |
| T11 | Forged Google Calendar push notifications                   | Per-channel random token, stored hashed, compared on every push; rate-limited                                                                                                                                                           | Built                                          |
| T12 | OAuth callback forged or replayed                           | Signed, expiring `state` bound to the user                                                                                                                                                                                              | Built                                          |
| T13 | Huge uploads or request bodies                              | JSON bodies capped at 1 MB; upload size cap (`MAX_UPLOAD_BYTES`); upload endpoints rate-limited                                                                                                                                         | Built                                          |
| T14 | Path traversal in HLS file requests                         | Paths resolved and checked against the video's prefix before signing                                                                                                                                                                    | Built                                          |
| T15 | Malicious dependency or tampered CI action                  | Lockfile installs; actions pinned to commit SHAs; Dependabot; `contents: read` CI token                                                                                                                                                 | Built                                          |
| T16 | Unreviewed code or migrations reaching production           | Required checks, CODEOWNERS on sensitive paths, `production` environment approval before deploy                                                                                                                                         | Built (needs repo settings, see deployment.md) |
| T18 | Insider abuse (staff changing roles, grades, deleting data) | Append-only audit log                                                                                                                                                                                                                   | Partly: see [Audit logging](#audit-logging)    |
| T19 | Redis outage locks everyone out                             | Rate limiter fails open and logs `rate limiter unavailable`                                                                                                                                                                             | Built (alert on the log line)                  |

## Controls in the code

### Authentication and sessions

`apps/web/src/lib/auth.ts` (Better Auth):

- Email and password, with **email verification required** before sign-in. Passwords are 10–128 characters.
- Google sign-in requests login scopes only. API access is a separate teacher grant (see below).
- **Self sign-up only with Google**, which verifies the email. New accounts are active students with no courses;
  a teacher approves each course join request (`server/services/join-requests.ts`). Password accounts are
  created by admins only. Roles are changed only by an admin (the Users page, or `db:set-role` for the very first admin).
- Sessions are stored in Postgres, last 7 days and are refreshed daily. Every request checks the database, so
  revoking a session or deactivating a user takes effect immediately.
- A session can't be created for a user who is inactive or soft-deleted.
- Password reset links expire after 1 hour, and a reset signs out every other session.
- Cookies are `Secure` whenever `APP_URL` is HTTPS.

### Authorisation

- Route handlers go through `route()` in `apps/web/src/lib/http.ts`. It authenticates the user, checks the role,
  checks the origin, applies rate limits and validates input with zod.
- Services check permissions with `assertCan()` (`packages/core/src/rbac.ts`) and resource access with
  `server/policies.ts`. Enrollment is the single gate for course content.
- Resources a user can't access return **NOT_FOUND**, so ids don't leak.
- Route handlers can't import the database (`@elearner/db`). ESLint enforces this, so every query goes through a
  service that does the checks.

### Browser protections

- **CSP** (`apps/web/src/middleware.ts`): a per-request nonce with `strict-dynamic`; no `unsafe-inline` scripts;
  `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`. Forms may post only to the app and Google
  sign-in.
- **Headers** (`apps/web/next.config.ts`, on every response):
  - `nosniff`;
  - `X-Frame-Options: DENY`;
  - a strict referrer policy;
  - a Permissions-Policy that turns off camera, microphone and geolocation.
- **HTTPS-only protections**, on when `APP_URL` is `https://` (middleware): HSTS with preload,
  `Cross-Origin-Opener-Policy: same-origin`, the CSP's `upgrade-insecure-requests`, and `Secure` cookies. A
  plain-HTTP LAN UAT has none of them, which is one reason it must hold test data only.

  The static landing site sets the same headers through `vercel.json`.

- **CSRF**: `SameSite=Lax` session cookies, plus a same-origin `Origin` check on every POST/PUT/PATCH/DELETE in
  `route()`.

### Rate limits

All rate limits are stored in Redis, with atomic Lua counters (`lib/rate-limit.ts`).

| What                                      | Limit                |
| ----------------------------------------- | -------------------- |
| Email sign-in                             | 5 / min / IP         |
| Password reset, resend verification email | 3 / min / IP         |
| Other auth endpoints                      | 60 / min / IP        |
| Schedule a class                          | 30 / h / teacher     |
| Start an upload                           | 10 / h / user        |
| Upload part URLs                          | 600 / h / user       |
| Start an attachment upload                | 120 / h / user       |
| Attachment downloads                      | 300 / 10 min / user  |
| HLS files                                 | 2000 / 10 min / user |
| Progress beacons                          | 240 / h / user       |
| Google Calendar push                      | 600 / min            |

### Secrets and encryption

- Secrets are only in environment variables (see [environment.md](environment.md)). `.env` is gitignored, and
  CI uses throwaway values.
- Google refresh and access tokens are encrypted with AES-256-GCM before they are stored
  (`packages/core/src/crypto.ts`, `packages/google/src/credential-store.ts`). They use a keyring with key ids, so
  the key can be rotated without downtime. Rows still on an old key are re-encrypted when they are next read.
- Webhook channel tokens are stored as SHA-256 hashes.

### Google access

- Teachers grant Calendar, Meet (read-only) and Drive Meet-recordings (read-only) access **separately** from
  signing in, and only when they first schedule a class.
- The OAuth `state` is signed and expires. The Workspace domain is enforced on the grant.
- If Google reports the grant revoked (`invalid_grant`), the stored token is marked revoked and the teacher is
  asked to reconnect. We don't keep retrying with a dead token.

### Video

- The bucket is private, and listing is never exposed.
- The web app checks access for every playlist request. Playlists are rewritten so that each segment is a
  presigned URL that expires after twice the video's length plus 30 minutes, with a minimum of 1 hour.
- Uploads go straight from the browser to storage using presigned part URLs that expire after 1 hour. Size is
  capped, and stale multipart uploads are aborted every hour.
- Students only get videos that are in a lesson the teacher hasn't hidden.

### Assignment files and quizzes

- Students upload answer files with a presigned PUT under `submissions/<assignment>/<student>/`. A submission may
  only reference keys under the student's own prefix, and each must exist and be within 25 MB.
- Downloads are for the student who handed in and the course's staff, through a 5-minute presigned URL with
  `Content-Disposition: attachment`.
- Quiz answers and scoring stay on the server: questions sent to students never include the correct options,
  scores are computed on submit, a submit is claimed atomically (no double scoring), and answers after the time
  limit plus 60 s are ignored.

### Lesson files

- Teachers upload with a presigned PUT (15 minutes) to `attachments/<lessonId>/<uuid>/<name>`. Only listed file
  types are accepted (PDF, Office, OpenDocument, text, CSV, PNG/JPEG/GIF/WebP, zip; no HTML or SVG), up to
  50 MB, checked again against the stored object's real size when the upload is recorded.
- The server rebuilds the key from the lesson and attachment id when recording a file, so a request can't claim
  another lesson's object.
- Downloads check access (staff, or students enrolled in the course when the lesson is visible), then redirect to
  a 5-minute presigned URL with `Content-Disposition: attachment`, so a file never renders inline on our origin.

### Logging

- pino with `redact` for authorisation headers, cookies, passwords and tokens (`apps/web/src/lib/logger.ts`).
- Log ids, not personal data. Every API request logs a request id.

### Supply chain and delivery

- `pnpm install --frozen-lockfile` everywhere.
- Exact dependency versions, updated weekly by Dependabot in reviewable groups.
- GitHub Actions are pinned to commit SHAs, and workflow tokens are read-only.
- Images run as a non-root user, from slim bases, with only production dependencies.
- Deploys need CI to pass and a reviewer to approve the `production` environment before migrations run.

## Audit logging

`AuditLog` is append-only: rows are never updated or deleted by the app. They are written with
`audit()` in `apps/web/src/server/audit.ts` and record who did what, to which resource, and when.

**Logged today:**

- `google.connect`
- `class.schedule`, `class.reschedule`, `class.cancel`
- `video.upload`
- `user.purge` (written by the worker), `user.delete_request` (someone deletes their own account), `user.restore`
  (an admin cancels a deletion before the purge)
- `course.create`, `course.join_request`, `enrollment.approve`, `enrollment.decline`
- `user.create`, `user.invite`, `user.role`, `user.activate`, `user.deactivate` (the admin Users page, and
  `user.role` also from the "Admin: set user role" workflow)
- `enrollment.remove` (a teacher removes a student from a course)
- `attendance.mark` (a teacher saves attendance for a class)
- `assignment.create`, `assignment.update`, `assignment.delete`, `assignment.submit`, `grade.edit` (with the
  previous and new score), `quiz.create`, `quiz.update`, `quiz.delete`
- `grade.excuse`, `grade.unexcuse`, `grade.weighting`, `school.settings`
- `grade.export` (a teacher or admin downloads a course gradebook as CSV: names, emails and marks)
- `lesson.reorder` (drag and drop in a module)
- `consent.grant`, `consent.withdraw` (a student agrees to or withdraws from the class-recording notice)
- `payment.settings`, `payment.submit`, `payment.approve`, `payment.reject`, `course.price` (manual UPI payments)
- `parent.link`, `parent.unlink` (an admin links a parent account to a student, or removes it)
- `course.update`, `course.cover`, `module.create`, `module.delete`, `lesson.create`, `lesson.update`, `lesson.delete`,
  `attachment.create`, `attachment.delete` (course editing)

**Must be added with the features that need them:**

- denied video access

## Personal data and the DPDP Act 2023

India's Digital Personal Data Protection Act applies. All students are adults (18+), so section 9 (children's
data, verifiable parental consent) does not apply; the parental-consent flow was removed on 2026-10-16 and its data
(dates of birth, parent links and names) dropped by migration `remove_parental_consent`. If the school ever admits
under-18s, that flow has to come back first (see git history).

| Requirement                       | How we meet it                                                                                                                                                                                                                                                                                                  | Status                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| No tracking or targeted ads       | No analytics, ad or tracking scripts anywhere. The CSP would block third-party scripts anyway.                                                                                                                                                                                                                  | Built                          |
| Data minimisation                 | No date of birth, phone numbers or addresses.                                                                                                                                                                                                                                                                   | Built                          |
| Consent to be recorded in classes | Students agree to the recording notice (`/recording-consent`, versioned `Consent` rows) before joining live classes from E-learner; withdraw any time                                                                                                                                                           | Built (see known gaps)         |
| Erasure on request                | Students and parents delete their account at `/account` (teachers and admins via an admin). Soft-delete (`deletedAt`) signs them out and blocks sign-in at once; an admin can cancel within 30 days; then the worker purges the user, their data (cascade) and their submission files, and writes an audit row. | Built                          |
| Grievance officer                 | Contact details in the site footer                                                                                                                                                                                                                                                                              | Planned                        |
| Data location                     | Choose India or nearby regions for Vercel functions, Postgres and R2                                                                                                                                                                                                                                            | To decide (architecture.md G7) |
| Breach notification               | Tell the Data Protection Board and affected users without delay                                                                                                                                                                                                                                                 | Process: see below             |

Known erasure limits:

- The purge skips users who still own courses, videos or classes; it logs a warning so an admin can reassign them
  first.
- A purged student's face and voice can still be in class recordings that belong to the course. Handle that case
  by case with the school.

_Not legal advice. Have counsel review the privacy notice before launch._

## If something goes wrong

1. **Contain:**
   - rotate the exposed secret (see [environment.md](environment.md));
   - revoke sessions by deactivating the affected users;
   - disconnect Google grants if tokens may be exposed.
2. **Assess:** use the audit log and request logs to find what was accessed and whose data it was.
3. **Notify:** the school's data protection contact decides on notifying the Data Protection Board and the
   affected users. Do this promptly; the DPDP rules expect notification without delay.
4. **Fix and review:** write a blameless postmortem and add a test or control so the same thing can't happen again.

The full step-by-step version is [runbooks/incident-response.md](runbooks/incident-response.md).

## Known gaps

The security-relevant gaps, most important first:

- **The recording-consent gate only covers joining from E-learner.** Students are Google Calendar guests of the
  class event, so the Meet link is also in their Google invite. Teachers see "Not agreed to recording" on the
  attendance sheet. Closing this needs classes without per-student Google invites (a product decision).
- **Manual UPI payments are checked by a person.** The app can't see your bank account: an admin must match each
  UTR against the bank statement before approving. A UTR can be used once. Payment records are deleted with the
  student's account on erasure; if you need them for your accounts (tax rules usually ask for years), export them
  first (a decision for the school).
- **Age is not checked.** Students are adults by school policy; the app takes that on trust.
- **Audit coverage is partial.** See [Audit logging](#audit-logging).
- **The general API rate limit (120/min/user in the spec) isn't applied to every route.** Only the routes in the
  table above are limited.
- **Backups:** Neon point-in-time recovery must be turned on and a restore tested before launch. The weekly
  encrypted dump to a separate bucket isn't set up yet.
- **No error reporting or alerting yet.** `SENTRY_DSN` isn't wired up. Alert on `rate limiter unavailable` and on
  failed jobs once monitoring exists (architecture.md §5.4).
- **Region placement** isn't decided (architecture.md G7).
