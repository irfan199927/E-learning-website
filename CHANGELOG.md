# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Dates are in IST.

## [Unreleased]

### Changed — dark theme matches light (2026-10-18)

- Landing page: dark mode is now the same design as light (heavy sans headline, blue → violet → pink → orange
  gradient, 28 px cards) on near-black, with white pill buttons. It used to switch to a green monospace
  "terminal" look that read like a different site.
- App: cards stand out more from the page; status chips (green, amber, red) use deep tints with light text
  instead of pale light-mode chips; hover fills lighten the row instead of darkening it (new `hover` token);
  white text on solid green uses `on-success`.

### Added — collapsible sidebar (2026-10-18)

- On desktop the sidebar collapses to an icon rail with the button at its foot, and expands again. The choice is
  remembered (`sidebar` cookie, read on the server so the page never jumps). Collapsed links keep their names
  for screen readers and show them as a tooltip. Phones keep the slide-in drawer.

### Changed — staff screens restyled (2026-10-18)

- Main screens (Courses, Calendar, Upload, Users, Payments, Settings) open with a shared header: an icon chip,
  the title and one line of intro (`components/page-header.tsx`).
- Teachers and admins see their courses as a grid of cards: cover, student and lesson counts, and an amber
  "waiting to join" chip that jumps to the requests. The whole card lifts on hover and opens the course.
- Course page sections get icon headings; assignment and quiz rows highlight on hover.
- Users: initials coloured by role (admin red, teacher green, student blue, parent amber), rows highlight on
  hover.

### Changed — staff area look and motion (2026-10-18)

- A welcome banner on the teacher and admin Overview: date, greeting and quick actions.
- "Needs your attention" cards get a colour per kind of work and numbers that count up; school totals get icons.
- Motion across the app: pages rise in, lists stagger, link cards lift on hover, buttons squeeze when pressed,
  and the sidebar's active item gets a marker bar. All of it is off with the system's reduced-motion setting.

### Changed — staff screens, second pass (2026-10-18)

- Calendar dates read day-first in English too (`Mon 12/10`, `12 – 18 Oct 2026`), like the rest of the app.
- Disabled outline buttons (the first lesson's "move up", the last one's "move down") fade out instead of turning
  grey, which looked pressed.
- An assignment lists the students waiting for a grade first, then graded work, then those who haven't handed in.
- A quiz that students have taken shows its locked questions greyed out, under a visible notice.

### Fixed — video playback (2026-10-18)

- The player now uses hls.js wherever the browser supports it and falls back to native HLS only without Media
  Source Extensions. Before, browsers that claim native HLS (newer Chrome) skipped hls.js, and lessons listed
  but didn't play on UAT. Confirmed playing on UAT after the change. Playback errors now show the "stopped" message and log the hls.js error to the console.

### Changed — staff and admin UI/UX pass (2026-10-18)

An audit of every teacher and admin screen against the ui-ux-pro-max rule set (navigation hierarchy, content
priority, destructive emphasis, tab badges, semantic colour tokens), and the fixes:

- **Needs your attention** on the staff Overview: work to grade, join requests, classes without attendance; for
  admins also payments to check, accounts being deleted, and school totals. Each card links to the oldest item.
- The admin sidebar groups Users, Payments and Settings under **Administration**; Settings has its own icon.
- Course page (staff): sticky section shortcuts with counts.
- Users: role filter chips instead of a dropdown (one click, keeps the search), initials avatars.
- Destructive buttons (switch off, remove, delete) use a new red `danger` variant.
- Payments: the "To check" tab shows how many are waiting.
- Red badge text uses the `live-fg` token instead of a hard-coded colour.

### Changed — Google invites no longer carry the Meet link (2026-10-18)

- Each class gets its own Meet room (Meet API `spaces.create`, access `TRUSTED`) instead of a Calendar conference,
  so the Google invite has no join link and says to join from E-learner. Students therefore pass the
  recording-consent check before they get the link. Recordings and attendance still match by meeting code.
- Teachers grant one more Google permission (`meetings.space.created`). A teacher connected before this change
  is shown "Connect Google" again until they reconnect.

### Changed — payment records are kept forever (2026-10-18)

- Deleting a student's account (erasure) or a course no longer deletes their payment records: the row stays,
  unlinked, with the payer's name, email and course title copied at submission (migration
  `20261018060000_keep_payment_records` backfills them). Payment screenshots still go with the account.

### Added — UAT on Rocky Linux (2026-10-18)

- `deploy/uat/bootstrap-vm.sh` also supports Rocky Linux, AlmaLinux and RHEL (dnf, Docker's RHEL repository,
  firewalld). UAT runs on a Rocky Linux 10 VM in the home lab.

### Added — whole app in Hindi and Marathi, OpenAPI, loading skeletons (2026-10-17)

- Teacher and admin screens are translated too: course and lesson editors, video upload, assignment and quiz
  editors, scheduling, attendance, Users, Payments and Settings.
- `GET /api/v1/openapi.json`: an OpenAPI 3.0 document, request bodies and query parameters generated from the
  zod schemas (`apps/web/src/server/openapi.ts`; a test fails when a route is missing from it).
- The Overview shows a skeleton while it loads; My courses and Notifications have friendlier empty states.

### Added — student and parent screens in Hindi and Marathi (2026-10-17)

- Translated: Overview, notifications, class recordings, My children, My courses and the catalog, course, lesson
  and video pages, paying, assignments, quizzes, grades, the calendar, and password reset. Staff editors and
  admin pages are still English.
- Messages are now one file per screen and language (`apps/web/messages/<locale>/<Namespace>.json`).
- Dates keep Western digits in every language (Marathi defaulted to Devanagari digits).

### Added — emails in Hindi and Marathi (2026-10-17)

- Every email (sign-up, password reset, invite, account deletion, class reminders, the daily digest) is written
  in the recipient's language: `User.locale`, saved when they choose a language on the Account page
  (`PUT /api/v1/me/locale`). Wording lives in `packages/notify/src/copy.ts`.

### Added — daily email of unread notifications (2026-10-17)

- Worker job `send-notification-digest` (18:00 school time): one email per person with the newest unread
  notifications from the last day that weren't emailed yet, linking back into the app. Each notification is
  emailed at most once (`Notification.sentAt`, claimed before sending, released if the send fails).
- Account page → **Emails**: switch the daily summary off or on (`User.emailDigest`, on by default; migration
  `notification_digest`). API: `PUT /api/v1/me/email-digest`.

### Added — payments CSV for the accounts (2026-10-17)

- Admin → Payments → **Download for your accounts**: payments reported between two dates (the admin's time zone,
  at most a year), all or one status, with amount, UPI reference, student, course and the decision. Formula
  injection is escaped (`toCsv`); each download is audited `payment.export`.
- API: `GET /api/v1/admin/payments/csv?from=&to=&status=`.

### Added — Hindi and Marathi interface (first screens) (2026-10-17)

- next-intl (no locale in URLs): the language comes from a `locale` cookie, else the browser's Accept-Language.
  Language picker on the Account page and on the sign-in screens; `<html lang>` follows it.
- Translated: the app shell (navigation, top bar), sign-in and Account. Other screens fall back to English for
  now. Messages live in `apps/web/messages/{en,hi,mr}.json`; tests check translations against English.
- Self-hosted Noto Sans Devanagari, downloaded only when a page shows Devanagari text.

### Added — API reference, testing guide and runbooks (2026-10-17)

- `docs/api.md`: conventions (auth, 404 for hidden resources, problem+json error codes) and every `/api/v1`
  endpoint by area.
- `docs/testing.md`: test layers, commands, resetting the dev database for e2e, fixture conventions.
- `docs/runbooks/`: recording sync, transcode failures, Google reconnect, payments, database restore, secret
  rotation, incident response.

### Added — installable app (PWA) (2026-10-17)

- `app/manifest.ts` (`/manifest.webmanifest`): installable as "E-learner" from the browser ("Add to Home
  screen"), opening on the Overview, with app icons in `public/icons` (also the favicon and Apple touch icon).
- `public/sw.js`: pages always come from the network; when it's down, a cached `/offline` page shows instead.
  Only hashed build assets and icons are cached, never signed-in pages, API responses or videos.
- CSP adds `worker-src 'self'` and `manifest-src 'self'`; `/sw.js` is served `no-cache`; the web Docker image now
  copies `apps/web/public`.

### Added — daily goal setting, questions answered, grade weighting and excusals (2026-10-17)

- **Admin → Settings** (`/admin/settings`): the daily learning goal (5–240 min) behind each student's
  Today's progress ring (was a fixed 30 min). Audited `school.settings`.
- Today's progress (students and parents) shows **Questions answered** today.
- Gradebook: **Excuse** a student from a missing assignment or quiz (and **Undo**): excused work is left out
  of totals and averages. **Weighting**: by points (default) or by category (assignments X%, quizzes the
  rest). Audited `grade.excuse`, `grade.unexcuse`, `grade.weighting`.
- Migration `learning_extras`: `SchoolSettings`, `GradeExcusal`, `Course.assignmentWeight`.
- API: `GET|PUT /api/v1/admin/settings`, `PUT /api/v1/courses/:id/gradebook/excusals`,
  `PUT /api/v1/courses/:id/gradebook/weighting`.

### Added — Markdown, drag and drop, video replacement, orphan clean-up (2026-10-17)

- Readings, link/file lesson instructions and assignment instructions are **Markdown**, with a **Preview**
  toggle and a formatting hint in the editors. Raw HTML and unsafe links are never rendered; plain text written
  before keeps its line breaks.
- Lessons can be **dragged and dropped** within a module (`PUT /api/v1/modules/:id/lesson-order`, full order,
  refused if the lessons changed meanwhile). The Move up / down buttons stay for keyboard users.
- **Replace video** on a video lesson: the new upload is processed while students keep the old one; the worker
  swaps it in when ready (migration `video_replacement`: `Video.replacesLessonId`).
- New daily worker job `sweep-orphan-uploads`: deletes uploads under `attachments/`, `courses/`,
  `submissions/` and `payments/` that nothing in the database points at, once they're 2 days old.

### Changed — live notification count and clean-up (2026-10-17)

- The bell's unread count updates without a reload: on every page change, every minute while the tab is
  visible, and when the tab comes back (`GET /api/v1/notifications/unread-count`).
- New daily worker job `prune-notifications`: read notifications go after 90 days, unread ones after a year.

### Added — paid courses with manual UPI payments (2026-10-17)

- No payment gateway needed. Admins publish the school's **UPI ID and/or UPI number** (plus payee name,
  instructions and an optional **QR code** image) on **Admin → Payments**, and set a course's **price** on Edit
  course.
- Paid courses show their price and **Pay and join** in the catalog (asking to join is refused). The pay page
  shows where to pay, a QR code and an **Open my UPI app** link (`upi://pay`, amount filled in); the student then
  reports the **UTR** (and optionally a screenshot and note).
- Admins are notified, check the bank statement and **Approve** (enrols the student, who is notified) or
  **Reject** with a reason (the student can report again). A UTR can be used once; one report at a time per
  course. Audited.
- Migration `manual_upi_payments`: `PaymentSettings` (one row), `ManualPayment`. The erasure purge also deletes
  the student's payment screenshots.
- API: `GET|PUT /api/v1/admin/payment-settings`, `POST /api/v1/admin/payment-settings/qr/uploads`,
  `PUT|DELETE /api/v1/admin/payment-settings/qr`, `GET /api/v1/payment-qr`, `PUT /api/v1/courses/:id/price`,
  `GET|POST /api/v1/courses/:id/payments`, `POST /api/v1/payments/proofs`, `GET /api/v1/admin/payments`,
  `PATCH /api/v1/admin/payments/:id`, `GET /api/v1/admin/payments/:id/proof`.
- Tests: integration tests now share one database pool per run (17 files had started to exhaust Postgres's
  100 connections).

### Added — catalog search and course covers (2026-10-17)

- **Search courses** on Find a course (title, description or teacher). The catalog now lists only courses the
  student isn't in, at most 60 alphabetically, so search is how long catalogs stay usable.
- Teachers can upload a cover image on Edit course (JPEG, PNG or WebP, up to 2 MB; straight to storage, size
  checked on completion). It replaces the colour tile everywhere; **Remove cover** goes back. Covers of published
  courses are visible to anyone signed in; drafts only to staff. Audited as `course.cover`.
- Migration `course_cover` adds `Course.coverKey`.
- API: `POST /api/v1/courses/:id/cover/uploads`, `PUT|DELETE /api/v1/courses/:id/cover`, `GET .../cover?v=`
  (redirect to a signed URL).
- Tests: the recording-consent e2e test no longer assumes a freshly seeded student.

### Added — account page and self-service deletion (2026-10-17)

- `/account` (the name and avatar in the top bar link to it): your details, a link to class recordings for
  students, and **Delete my account** for students and parents (type `DELETE` to confirm).
- Deleting signs the person out everywhere and blocks sign-in at once; they get an email with the date. The
  worker purges the account 30 days later, as before, and now also deletes their submission files from storage.
- Admins see "Deleting on …" on the Users page and can **Cancel deletion** until the purge.
- Audited: `user.delete_request`, `user.restore`. No database change.
- API: `POST /api/v1/me/deletion-request` (`{ confirm: "DELETE" }`), `POST /api/v1/admin/users/:id/restore`.

### Added — recording consent (2026-10-17)

- Students agree to a class-recording notice before joining live classes from E-learner (`/recording-consent`).
  A banner asks until they answer; the Join button sends them to the notice instead of Meet, and the server
  refuses the join. They can withdraw at any time.
- Each agreement is a versioned `Consent` row (type `RECORDING`); changing the notice text
  (`RECORDING_NOTICE_VERSION`) asks everyone again. Agreements and withdrawals are audited
  (`consent.grant`, `consent.withdraw`). No database change.
- Teachers see who hasn't agreed on the attendance sheet.
- Seed: Aanya has agreed; Rohan and Kabir haven't answered (re-seeding resets them).
- API: `GET`, `POST` (`{ version }`) and `DELETE /api/v1/me/recording-consent`.
- Known gap: students also get the Meet link in their Google Calendar invite, which the gate can't stop
  (docs/security.md).

### Added — gradebook and grade reports (2026-10-16)

- `/courses/:id/grades`: teachers and admins see a gradebook (every enrolled student × every published
  assignment and quiz, with totals and a class average row); students see **My grades** for the course.
- Totals count graded work and overdue work never handed in (as 0); work waiting to be graded or not due yet is
  left out. Quizzes count the best submitted attempt.
- **Download CSV**: one row per student with email, each score (or "missing" / "to grade"), points, out of and
  percent. UTF-8 with a byte order mark for Excel; cells that start like a formula are escaped. Each export is
  audited (`grade.export`).
- API: `GET /api/v1/courses/:id/gradebook`, `GET /api/v1/courses/:id/gradebook/csv`,
  `GET /api/v1/courses/:id/my-grades`.
- Tests: core unit tests (cell rules, totals, CSV escaping), an integration test (statuses, totals, averages,
  access, CSV, audit) and the e2e work test now checks the gradebook, the CSV download and My grades.

### Removed — parental consent (2026-10-16)

- Students are all adults (18+), so the parental-consent flow is gone: no date-of-birth step at `/welcome`, no
  parent approval email or `/consent/:token` page, and no "Needs your parent's approval" block on joining courses.
  Students ask to join and teachers approve, nothing else.
- The admin Users page no longer shows "Under 18" badges. Parents are still linked to students by an admin.
- Migration `remove_parental_consent` drops `ConsentRequest`, `User.dateOfBirth`/`isMinor` and the parent
  name/email on `Consent` (data minimisation: nothing uses them now).
- API removed: `POST /api/v1/me/date-of-birth`, `POST /api/v1/me/parent-consent`, `POST /api/v1/consent/:token`.

### Added — in-app notifications (2026-10-16)

- A bell in the top bar with an unread badge, and `/notifications`: newest first (50 per page), opening one marks
  it read and follows its link, **Mark all as read**.
- New notifications: teachers hear about join requests; students hear about newly published assignments and
  quizzes (once per item, even if it's unpublished and published again). Existing ones (approvals, grades,
  consent, reminders, recording issues) now have somewhere to be read.
- Links are only followed when they're same-site paths (`safeLink`).
- API: `GET /api/v1/notifications?before=`, `PATCH /api/v1/notifications/:id`, `POST /api/v1/notifications/read-all`.
- Tests: 2 integration tests (own rows only, read / read all, link safety; join-request and publish
  notifications, once); an e2e test from a join request to the teacher opening it from the bell.

### Added — assignments and MCQ quizzes (2026-10-16)

- **Assignments:** teachers set work (instructions, due date, points, written answer and/or files, late work
  allowed or not, draft or visible). Students hand in text and up to 5 files (25 MB each, straight to storage),
  again until it's graded; late work is marked late or refused. Teachers see every student, read answers,
  download files and grade with a score and feedback. The student gets an in-app notification; grade changes
  are audited as `grade.edit` with the previous score.
- **MCQ quizzes:** a question editor (2–6 options, one or several correct, points, order), time limit, attempts,
  closing date, shuffled order per attempt. Students take timed attempts with a countdown and auto-submit;
  scoring happens on the server (all-or-nothing per question). Results show right/wrong at once and the correct
  answers when no attempts are left. Teachers get a results table. Questions lock once anyone has submitted.
- Course pages get **Assignments** and **Quizzes** sections; parents see a **Grades** table on their child's page.
- Core: `grading.ts` (`scoreQuiz`, `seededShuffle`, `submissionTiming`, `attemptDeadline`) and the assignment and
  quiz schemas. No migration: the tables were in the initial schema.
- API: `GET|POST /courses/:id/assignments`, `GET|PATCH|DELETE /assignments/:id`, `POST /assignments/:id/files`,
  `PUT /assignments/:id/submission`, `PATCH /submissions/:id/grade`, `GET /submissions/:id/files/:index`,
  `GET|POST /courses/:id/quizzes`, `GET|PUT|DELETE /quizzes/:id`, `GET /quizzes/:id/questions`,
  `GET /quizzes/:id/results`, `POST /quizzes/:id/attempts`, `PUT /attempts/:id`.
- Tests: 4 unit tests (scoring, shuffle, timing, quiz validation); 4 integration tests (hand-in and grading with
  files and access rules; due dates and drafts; quiz attempts, limits and reveal; time limit, closing and
  drafts); an e2e test from setting both to the parent seeing the grades.

### Added — classes without Google, and manual attendance (2026-10-16)

- **Schedule a class without Google**: in a room and/or on any https meeting link the teacher pastes. Weekly
  repeats are expanded by the app (`expandWeekly` in core, keeping the wall-clock time across DST). These
  classes reschedule and cancel without Google, get reminders (which name the room), and never queue a recording
  sync. With Google connected, the teacher chooses Google Meet or "A room or another link".
- **Take attendance** (`/classes/:id/attendance`): Present / Absent per student, Mark everyone present, Save.
  Open to the host, the course teacher and admins once the class has started. The teacher's mark wins over Google
  Meet's automatic one. Reached from a new **Attendance** section on the course page, **Take attendance** on the
  Overview for a class in progress, and by clicking a started class in the Calendar.
- Students see the room on their Overview ("In person" instead of Join). Parents see classes from the moment they
  start, so a mark taken during the class shows up straight away.
- Migration `class_location` adds `ClassSession.location` (nullable).
- API: `GET|PUT /api/v1/classes/:id/attendance`; `POST /api/v1/classes` takes `meeting` ("google" | "none"),
  `location` and `meetingUrl`. Audited as `attendance.mark`.
- Tests: 2 unit tests (weekly expansion, DST); 2 integration tests (scheduling, rescheduling, cancelling and
  joining without Google; attendance rules, Meet override, parent view, recent classes); an e2e test from
  scheduling an in-person class to the parent seeing "Attended".

### Added — parent progress view (2026-10-16)

- **My children** for parents (`/children`, and a "Your children" section on the Overview): one card per linked
  child with streak, today's minutes, lessons done and courses.
- **A child's page** (`/children/:id`, read-only): Today's progress, Monthly progress, progress per course, and
  live-class attendance for the last 30 days. It reuses the learner read models, computed in the child's
  timezone, so parents see the same numbers as the child.
- **Linking parents and children:**
  - automatic when a parent with an account consents from the emailed link, or when an admin adds a parent
    account whose email already gave consent;
  - by hand on the Users page: **Link a student** (by email) and **Unlink** on parent rows.
- Only verified `ParentLink`s count; any other child id is a 404.
- API: `GET /api/v1/children`, `GET /api/v1/children/:id`, `POST /api/v1/admin/users/:id/children`,
  `DELETE /api/v1/admin/parent-links/:id`. Audited as `parent.link` and `parent.unlink`.
- "Today's progress" and "Monthly progress" moved to `components/learner-progress.tsx` so both views share them.
- Tests: 3 integration tests (progress and attendance, access rules, admin linking, linking from consent); 2 e2e
  tests (a parent's read-only view and 404 for other ids; an admin links a new student and unlinks them).

### Added — course editing: modules, lessons and files (2026-10-16)

- **Edit course** (`/courses/:id/edit`, the course teacher and admins):
  - modules: add, rename, reorder, delete (empty ones only);
  - lessons: Reading (text), Link, Files and Video; reorder, hide/show, move between modules, delete (a video
    lesson's video is kept and listed under "Videos not in a lesson");
  - course details: title, grade, description, card colour, and whether it's listed in Find a course.
- **Edit lesson** with file attachments (PDF, Office, images, zip…, up to 50 MB each, 20 per lesson), uploaded
  straight to storage and downloaded through an access-checked redirect.
- **Lesson page** `/courses/:id/lessons/:lessonId`: video, text, link or files, **Mark as done** for non-video
  lessons, and Previous / Next.
- Course pages, course cards, the resume card and progress now follow modules and lessons in the teacher's order
  instead of videos in upload order. Hidden lessons and their videos and files are staff-only.
- Uploads become a lesson at once: in the module picked on the upload page, or a "Videos" module. Cancelling an
  upload removes it.
- New `LessonProgress` table (migration `lesson_progress`, additive). The migration also gives every existing
  video without a lesson a published lesson in a "Videos" module, so nothing students could see disappears.
- API: `PATCH /courses/:id`, `POST /courses/:id/modules`, `PATCH|DELETE /modules/:id`,
  `POST /modules/:id/lessons`, `PATCH|DELETE /lessons/:id`, `PUT|DELETE /lessons/:id/progress`,
  `POST /lessons/:id/attachments/uploads`, `POST /lessons/:id/attachments`, `GET|DELETE /attachments/:id`.
- Disabled buttons use theme tokens, so they no longer glow white in dark mode.
- CI's e2e job runs MinIO for the attachment tests.
- Tests: 4 integration tests (course building and order, hidden lessons, prev/next and ticks, moving and deleting;
  video lessons kept as loose videos; edit permissions; attachments end to end); an e2e test from an empty
  course to a student downloading a file.

### Added — parental consent for under-18s (DPDP) (2026-10-16)

- **Date of birth at first sign-in.** Every student is sent to `/welcome` once.
- **Under-18s can browse courses but can't join** until a parent consents. Teachers can't approve them either.
  The rule is enforced in the services, not only in the UI.
- **Parent consent by email.**
  - The student enters a parent's email, and the parent gets a single-use link, valid for 7 days. Only its hash
    is stored; asking again replaces the old link.
  - The link opens a public page explaining what the school keeps and why.
  - The parent confirms they're the parent or guardian and types their name. No account needed.
  - `Consent` records the parent's name and email, the time, the IP, the method and the notice version.
- The Users page shows each under-18 student's consent status.
- New `ConsentRequest` table and `Consent.parentName` / `parentEmail` (migration `parental_consent`, additive).
- API: `POST /api/v1/me/date-of-birth`, `POST /api/v1/me/parent-consent`, and the public
  `POST /api/v1/consent/:token`. Audited as `user.dob`, `consent.request` and `consent.grant`.
- The seed gives demo students birth dates, and consent records for the two minors.
- Tests: age unit test; 3 integration tests (date-of-birth gate, the full consent flow including the teacher
  approval gate, expiry, replacement and unknown links); an e2e test from admin invite → date of birth → parent's
  email → parent consents → student can ask to join.

### Added — admin Users page and course rosters (2026-10-16)

- **Users** (`/admin/users`, admins): add people one at a time or from a CSV (`email,name[,role]`, up to 500).
  - Bad lines are reported with line numbers before anything is sent.
  - Each new person gets a **welcome email to choose a password**. It reuses Better Auth's reset flow, with its
    own "You've been added" wording.
  - Also: search, filter by role, change roles, **switch accounts off** (signs them out everywhere at once),
    and resend invites.
  - Guard rails: no changing your own role or switching yourself off, and the last admin can't be demoted.
- **Students** section on each course page for its teacher: the roster, with **Remove**, which ends access at
  once and keeps the history.
- API:
  - `GET`/`POST /api/v1/admin/users`
  - `PATCH /api/v1/admin/users/:id`
  - `POST /api/v1/admin/users/:id/invite`
  - `DELETE /api/v1/courses/:id/students/:userId`

  All of them are audited.

- CI's e2e job now runs Mailpit, so the e2e test follows a real invite email to set a password.
- Tests: CSV parser unit test; 5 integration tests (create/skip/invite, search and permissions, deactivation
  revokes sessions, self-lockout guards, roster removal); e2e for the invite → password → switch-off flow and
  for non-admins being refused.

### Added — UAT on a home-lab VM (2026-10-16)

- **`deploy/uat/`:** the whole app on one Linux VM with Docker Compose.
  - Services: web, worker, Postgres, Redis (`noeviction`, AOF), MinIO, and Mailpit as the UAT inbox.
  - A `tools` image runs migrations and admin commands.
- **Automatic updates without exposing the home network.** A systemd timer runs `auto-update.sh` every 2 minutes.
  It deploys a new `main` commit only after all of its GitHub checks have passed: build, migrate, restart, then a
  readiness check. The repo is public, so there's deliberately no self-hosted runner.
- **Setup and day-to-day tasks:**
  - `bootstrap-vm.sh` installs Docker, the service user, the checkout, secrets and the timer.
  - `init-env.sh` writes `/opt/elearner/uat.env` with random secrets.
  - `manage.sh` handles `create-user`, `set-role`, `demo-data`, `logs`, `status` and `backup`.
- **`pnpm db:create-user -- <email> "<name>" [ROLE]`** creates a password account and prints a one-time password,
  for servers without Google.
- Guide: `docs/uat.md`. `docs/deployment.md` now lists the environments (Vercel landing page, UAT VM, AWS
  production plan) and maps each UAT service to its AWS counterpart.

### Changed

- **Google is optional.** With `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` empty:
  - the sign-in page hides "Continue with Google";
  - Better Auth registers no Google provider;
  - teachers connecting Meet get a clear message.
- **Plain-HTTP hosts work.** The CSP adds `upgrade-insecure-requests` only when `APP_URL` is HTTPS. On a LAN UAT it
  used to redirect every asset to `https://` and break the page.
- An empty `GOOGLE_WORKSPACE_DOMAIN` now means "not set" instead of failing validation. Compose passes unset
  variables as empty strings.
- Removed the free-tier plan (Neon, Upstash and a second Vercel project) and `apps/web/vercel.json`. Only the
  static landing page stays on Vercel.

### Added — open Google sign-up with teacher-approved course access (2026-10-16)

- **Anyone can sign up with Google.** A new account is an active student with **no courses**. Password accounts
  are still created by admins only. Setting `GOOGLE_WORKSPACE_DOMAIN` still limits sign-in to one domain.
- **Find a course** on `/courses`: students see published courses and **Ask to join**. Content stays closed until
  the teacher approves.
- **Join requests** on each course page for its teacher (and admins), with **Approve** and **Decline**.
  - Approving enrols the student and sends an in-app notification.
  - A badge on the course list shows how many students are waiting.
  - New `JoinRequest` table (migration `join_requests`) and API: `POST /api/v1/courses/:id/join-requests`,
    `GET` for teachers, and `PATCH /api/v1/join-requests/:id`.
- **New course** (`/courses/new`, `POST /api/v1/courses`): teachers create a course, published at once.
- **Roles:** `pnpm db:set-role -- <email> <ROLE>`, and the GitHub workflow "Admin: set user role" for production.

- Tests: 5 new integration tests (join flow, declines, access rules, unpublished courses, course creation) and an
  e2e test of the whole flow on desktop and mobile. The seed adds `kabir@school.edu`, a student with no courses.

### Fixed — lost reminders and ever-growing storage (2026-10-16)

- **Reminders survive a Redis flush or failover.** Every 15 minutes the worker re-adds the 24 h and 15 min
  reminders for classes in the next 48 hours (`reconcile-reminders`). Existing jobs are left alone and the
  reminder job dedupes per user, so nobody is reminded twice. Closes design gap G4.
- **Original video files are deleted 30 days after transcoding** (`delete-transcoded-raw`, daily at 03:30 IST).
  Students only stream the HLS renditions, so this saves about 2 TB a year at pilot scale. After that a video can't
  be re-transcoded; Meet recordings stay in the teacher's Drive. Closes design gap G6.
- `Storage.deleteObject(key)` in `@elearner/storage`.

### Added — contributor, environment, security and Google setup docs (2026-10-16)

- `CONTRIBUTING.md`: branches, Conventional Commits (enforced by the commit hook), the checks to run before a PR,
  the required CI checks and a definition of done.
- `docs/environment.md`: every variable the web app, worker and static site read, with defaults, plus how to
  rotate the token encryption key and fix common configuration errors.
- `SECURITY.md` (private vulnerability reporting) and `docs/security.md`: threat model, the controls in the code,
  audit logging, DPDP handling and known security gaps. Each item is marked built or planned.
- `docs/adr/0001`–`0007`: architecture decision records for the choices code comments already cite (monorepo,
  route handlers + worker, Better Auth sessions, Prisma 7, gated HLS on R2, the separate Google grant, recurring
  classes as Google instances).
- `docs/google-setup.md`: the one-time Google Cloud and Workspace setup (APIs, Internal consent screen, scopes,
  redirect URIs, Meet recording policy) with a troubleshooting table.

### Changed — CI hardening and a smaller worker image (2026-10-16)

- Every third-party GitHub Action is pinned to a full commit SHA, with the release in a trailing comment
  (`actions/checkout@fbc6f39… # v5.1.0`). A moved or hijacked tag can no longer change what CI runs. Dependabot's
  weekly `actions` group bumps the SHA and the comment together.
- `packages/google` uses the per-API clients `@googleapis/calendar`, `@googleapis/drive` and `@googleapis/meet` instead
  of the full `googleapis` bundle. The worker's production `node_modules` drops from 354 MB to 174 MB. Requests are
  unchanged.

### Added — static landing site for Vercel (2026-10-16)

- `pnpm build:site` exports just the public landing page as static files (`apps/web/out`, about 1.2 MB). It shares
  its source with the app's `/` route through `*.site.tsx` route files and `STATIC_SITE=1` in `next.config.ts`.
- The root `vercel.json` holds the build, output, security and cache-header settings, so a Vercel project only needs
  the repository imported.
- Without a deployed app, Enroll and Sign in go to a new "Online enrolment opens soon" page. Setting
  `SITE_APP_URL` points them at the real sign-in instead.
- The theme switch re-applies a saved choice on the static site, where no server can read the cookie.
- New CI job **Static landing site** builds and checks the export on every PR.

### Added — light/dark theme switch and a light landing page (2026-10-16)

- **Theme switch** on every page: the landing header, the app top bar and the sign-in pages.
  - The choice is kept in a cookie and rendered on the server, so there's no flash of the wrong theme.
  - With no choice, the site follows the OS.
  - Switching animates as a circle growing from the button.
- **Light landing page**, now the default for light-mode visitors:
  - product-launch style with huge heavy headlines;
  - a blue → violet → pink → orange gradient through the CODE letters;
  - frosted header, soft-shadow cards and pill buttons.
  - The terminal look stays as the dark theme.
- **Fixed:** in dark mode, brand-blue text (active sidebar item, links) was hard to read. New `primary-fg` tokens keep
  it readable in both themes.
- e2e: the switch flips the theme, updates `aria-pressed`, and the server renders the saved choice after reload.

### Added — public landing page (2026-10-16)

- `/` is now an animated landing page advertising a sample coding course ("Code Foundations"). It used to be a
  redirect to the dashboard. Every **Enroll** button leads to sign-in, then on to My courses. Signed-in visitors get
  "Go to dashboard".
- Hero: **Glyph Portal** (`src/components/ui/glyph-portal.tsx`, MIT). Scrolling flies the camera through the word
  CODE and into the course.
- Other sections:
  - course facts;
  - a technology marquee;
  - a self-typing code editor;
  - a 12-week curriculum timeline;
  - project cards;
  - the next batch;
  - FAQ and the final CTA.
- Design direction from the ui-ux-pro-max skill: a dark terminal theme, JetBrains Mono headings and a green
  action colour. Motion respects reduced-motion and no-JS visitors.
- The sign-in page logo now links back to the landing page.
- e2e: `landing.spec.ts` covers the content, the Enroll → sign-in → My courses flow, the signed-in state, and
  reduced motion.

### Added — delivery: Docker images, CI and deploy (2026-10-16)

- `apps/web/Dockerfile` (Next standalone, ~470 MB, non-root, healthcheck) and `apps/worker/Dockerfile`
  (ffmpeg, production-only dependencies via `pnpm deploy`, non-root, healthcheck), plus `.dockerignore`.
- CI (`.github/workflows/ci.yml`):
  - format, lint, typecheck and unit tests;
  - integration tests on Postgres with real ffmpeg, after migrating from an empty database;
  - a production build, then Playwright on desktop and mobile;
  - Docker image builds with smoke tests.
- Deploy (`.github/workflows/deploy.yml`): CI → approval on the `production` environment → migrations →
  Vercel (web) and GHCR → Render (worker). It stays off until `DEPLOY_ENABLED=true`.
- Dependabot, CODEOWNERS and a PR template.
- `docs/deployment.md`: one-time setup, secrets, releasing, rollback.
- e2e regression test: the calendar shows a 10:30 IST class at 10:30 in a UTC browser.

### Changed

- `docker-compose.yml`: MinIO no longer publishes `minio/minio` / `minio/mc` images. Local S3 now uses the pinned
  community build `pgsty/minio:RELEASE.2026-08-04T00-00-00Z`.
- Playwright loads the root `.env` (for test fixtures) and starts its server with `NODE_ENV=production`.
- CI runs on pull requests. On `main` it runs once, as the first job of Deploy.

### Fixed

- The e2e "My courses" locator also matched the Overview's "See my courses" link on a fresh database.
- CI integration and e2e jobs (and the quickstart) now run `pnpm db:generate` first. The seed and integration tests
  import the gitignored Prisma client, which nothing had generated on a fresh checkout.

### Added — learner experience redesign (2026-10-16)

- **New app shell.**
  - On desktop, a sidebar with icons and an active pill.
  - On mobile, a slide-in drawer (menu button, Escape to close, closed drawer out of the tab order).
  - A top bar with the user's initials, name and role.
- **Learning streak** in the top bar for students: consecutive days with lesson time, on the student's own clock.
- **Student Overview:**
  - a Resume learning card (next lesson, X/Y lessons completed, progress ring);
  - Today's progress (minutes watched against a 30-minute goal, lessons completed, courses in progress);
  - a Monthly progress calendar with previous/next month;
  - Upcoming classes alongside.
- **Teacher Overview:** a "Your courses" panel with student and lesson counts.
- **My courses** (`/courses`): All / In progress / Completed filters, course covers, and Start / Resume /
  Review CTAs.
- **Course page** (`/courses/:id`): the lesson list with completed and partly-watched states. Teachers also see
  videos that are still processing or that failed.
- The lesson page links back to its course.
- `LearningDay` table and migration `20261016011408_learning_days`. Each progress beacon also adds its watch
  time to the learner's local day.
- `@elearner/core/learning`: `localDayKey`, `learningStreak`, `monthGrid`, `shiftMonth`, `courseProgressState`,
  `percent`.
- Docs: `docs/ui.md`, this changelog, an expanded README, and updates to architecture.md, CLAUDE.md and
  NEXT_STEPS.md.
- Tests: core unit tests for the streak and calendar rules, `learning.int.test.ts`, and e2e tests for the
  student overview, My courses, the mobile drawer and the parent redirect.

### Fixed

- The calendar rendered in UTC while labelled Asia/Kolkata, which hid morning classes in week view (`8a4c37a`).
- The Join button's "Opens 3:50 pm" now uses the school's timezone, not the browser's.
- e2e: Playwright now passes `APP_URL` for its own port. Before, every sign-in got a 403 unless you set it by
  hand.
- Integration test for weekly series used fixed Google event ids, so it failed on its second run against the
  same database.
- `prisma.config.ts`, the seed and `next.config.ts` now load the root `.env` in local dev (`fb12e0f`).

## [0.1.0] — 2026-10-15

- Initial monorepo:
  - web app: auth, dashboard, calendar with scheduling and drag-reschedule, upload, HLS player;
  - worker: reminders, recording sync, transcode, calendar sync;
  - shared packages, Prisma schema and migration;
  - 89 tests.
