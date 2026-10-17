# API reference

The web app's REST API lives under `/api/v1`. The pages use it from the browser; nothing else is supported yet
(no API keys or third-party clients). Each route is a thin handler in `apps/web/src/app/api/v1/**/route.ts` that
calls a service in `apps/web/src/server/services/*`; the doc comment above each handler is the source of truth.

## Conventions

- **Auth:** the Better Auth session cookie (`/api/auth/*` signs in and out). Without a session, routes return
  `401`. Each route lists the roles allowed; other roles get `403`.
- **Resources you can't see return `404`**, not `403`, so ids of other people's things don't leak.
- **Same origin:** `POST`, `PUT`, `PATCH` and `DELETE` with an `Origin` header from another site are refused (`403`).
- **Bodies** are JSON, validated with the zod schemas in `packages/core/src/schemas.ts`.
- **Success:** `{ "data": … }` (or `204 No Content`). Some `GET`s redirect (`302`/`303`) to a short-lived signed
  storage URL: downloads, covers, QR codes, payment screenshots, the Meet link.
- **Errors** are `application/problem+json`:

  ```json
  {
    "type": "about:blank",
    "title": "Some fields need attention.",
    "status": 400,
    "code": "VALIDATION",
    "requestId": "…",
    "errors": [{ "path": "reference", "message": "Enter the UPI reference (UTR) …" }]
  }
  ```

  | `code`                      | Status | Meaning                                              |
  | --------------------------- | ------ | ---------------------------------------------------- |
  | `VALIDATION`                | 400    | Bad input; `errors[]` names each field               |
  | `UNAUTHENTICATED`           | 401    | Not signed in                                        |
  | `FORBIDDEN`                 | 403    | Your role can't do this, or a cross-site request     |
  | `NOT_FOUND`                 | 404    | Doesn't exist, or you can't see it                   |
  | `CONFLICT`                  | 409    | Not possible in the current state (`title` explains) |
  | `GOOGLE_RECONNECT_REQUIRED` | 409    | The teacher's Google grant expired: reconnect Google |
  | `RATE_LIMITED`              | 429    | Too many requests; see the `Retry-After` header      |
  | `UPSTREAM`                  | 502    | Google or storage failed                             |
  | `INTERNAL`                  | 500    | Unexpected; the `requestId` is in the server logs    |

- Every response carries `x-request-id`.

## Endpoints

Roles: **S** student, **T** teacher, **A** admin, **P** parent, **any** = any signed-in user. "Staff" = the
course's teacher or an admin.

### Health and auth

| Method | Path                | Who    | What                                                  |
| ------ | ------------------- | ------ | ----------------------------------------------------- |
| GET    | `/api/health`       | public | Liveness                                              |
| GET    | `/api/health/ready` | public | Readiness: `{ status, checks: { database, redis } }`  |
| \*     | `/api/auth/*`       | public | Better Auth (email/password, Google, reset, sessions) |

### Account

| Method              | Path                           | Who  | What                                                   |
| ------------------- | ------------------------------ | ---- | ------------------------------------------------------ |
| POST                | `/api/v1/me/deletion-request`  | S, P | Delete my account (`{ confirm: "DELETE" }`), signs out |
| GET / POST / DELETE | `/api/v1/me/recording-consent` | S    | Read / agree (`{ version }`) / withdraw                |

### Courses, modules, lessons

| Method         | Path                                      | Who       | What                                           |
| -------------- | ----------------------------------------- | --------- | ---------------------------------------------- |
| POST           | `/api/v1/courses`                         | T, A      | Create a course                                |
| PATCH          | `/api/v1/courses/:id`                     | staff     | Title, grade, description, colour, listed      |
| PUT            | `/api/v1/courses/:id/price`               | A         | `{ priceRupees }` (0 = free)                   |
| POST           | `/api/v1/courses/:id/cover/uploads`       | staff     | Presigned PUT for a cover image                |
| PUT / DELETE   | `/api/v1/courses/:id/cover`               | staff     | Record / remove the cover                      |
| GET            | `/api/v1/courses/:id/cover?v=`            | any       | Redirect to the cover (drafts: staff only)     |
| GET / POST     | `/api/v1/courses/:id/join-requests`       | staff / S | List pending / ask to join (free courses only) |
| PATCH          | `/api/v1/join-requests/:id`               | staff     | `{ decision: "approve" \| "decline" }`         |
| DELETE         | `/api/v1/courses/:id/students/:userId`    | staff     | Remove a student                               |
| POST           | `/api/v1/courses/:id/modules`             | staff     | Add a module                                   |
| PATCH / DELETE | `/api/v1/modules/:id`                     | staff     | Rename or move / delete (empty only)           |
| POST           | `/api/v1/modules/:id/lessons`             | staff     | Add a lesson                                   |
| PUT            | `/api/v1/modules/:id/lesson-order`        | staff     | `{ lessonIds }`: the full new order            |
| PATCH / DELETE | `/api/v1/lessons/:id`                     | staff     | Edit, hide/show, move / delete                 |
| PUT / DELETE   | `/api/v1/lessons/:id/progress`            | S         | Mark a non-video lesson done / undo            |
| POST           | `/api/v1/lessons/:id/attachments/uploads` | staff     | Presigned PUT for a file                       |
| POST           | `/api/v1/lessons/:id/attachments`         | staff     | Record an uploaded file                        |
| GET / DELETE   | `/api/v1/attachments/:id`                 | staff, S  | Download (redirect) / remove                   |

### Videos

| Method        | Path                                  | Who  | What                                                    |
| ------------- | ------------------------------------- | ---- | ------------------------------------------------------- |
| POST          | `/api/v1/videos/uploads`              | T, A | Start a multipart upload (`replaceLessonId` to replace) |
| POST          | `/api/v1/videos/uploads/:id/parts`    | T, A | Presigned part URLs                                     |
| POST / DELETE | `/api/v1/videos/uploads/:id/complete` | T, A | Finish (queues transcoding) / abort                     |
| GET           | `/api/v1/videos/:id/hls/*`            | any  | Gated HLS playlists and segments (ADR-0005)             |
| PUT           | `/api/v1/videos/:id/progress`         | any  | Resume position and watched time                        |

### Classes and attendance

| Method         | Path                               | Who     | What                                                      |
| -------------- | ---------------------------------- | ------- | --------------------------------------------------------- |
| GET / POST     | `/api/v1/classes`                  | any / T | Classes in a range / schedule (Google Meet or none)       |
| PATCH / DELETE | `/api/v1/classes/:id`              | T, A    | Move one class / cancel it                                |
| GET            | `/api/v1/classes/:id/join`         | any     | Time-gated redirect to Meet (students: recording consent) |
| GET / PUT      | `/api/v1/classes/:id/attendance`   | T, A    | Sheet / save marks                                        |
| GET            | `/api/v1/calendar.ics`             | any     | Your classes as iCalendar                                 |
| GET            | `/api/v1/google/connect`           | T       | Start the Google API grant                                |
| GET            | `/api/v1/google/callback`          | T       | OAuth redirect target                                     |
| POST           | `/api/v1/google/webhooks/calendar` | Google  | Calendar push notifications (channel token checked)       |

### Assignments, quizzes, grades

| Method               | Path                                      | Who         | What                                         |
| -------------------- | ----------------------------------------- | ----------- | -------------------------------------------- |
| GET / POST           | `/api/v1/courses/:id/assignments`         | any / staff | List / create                                |
| GET / PATCH / DELETE | `/api/v1/assignments/:id`                 | S, staff    | Read / edit, publish / delete                |
| POST                 | `/api/v1/assignments/:id/files`           | S           | Presigned PUT for an answer file             |
| PUT                  | `/api/v1/assignments/:id/submission`      | S           | Hand in                                      |
| GET                  | `/api/v1/submissions/:id/files/:index`    | S, staff    | Download an answer file                      |
| PATCH                | `/api/v1/submissions/:id/grade`           | staff       | `{ score, feedback? }`                       |
| GET / POST           | `/api/v1/courses/:id/quizzes`             | any / staff | List / create                                |
| GET / PUT / DELETE   | `/api/v1/quizzes/:id`                     | S, staff    | Student view / save / delete                 |
| GET                  | `/api/v1/quizzes/:id/questions`           | staff       | With correct answers                         |
| GET                  | `/api/v1/quizzes/:id/results`             | staff       | Best score per student                       |
| POST                 | `/api/v1/quizzes/:id/attempts`            | S           | Start (or resume) an attempt                 |
| PUT                  | `/api/v1/attempts/:id`                    | S           | Submit answers; returns the score            |
| GET                  | `/api/v1/courses/:id/gradebook`           | staff       | Every student's marks and totals             |
| GET                  | `/api/v1/courses/:id/gradebook/csv`       | staff       | CSV download (audited)                       |
| PUT                  | `/api/v1/courses/:id/gradebook/excusals`  | staff       | Excuse / un-excuse one student from one item |
| PUT                  | `/api/v1/courses/:id/gradebook/weighting` | staff       | `{ assignmentWeight: 0–100 \| null }`        |
| GET                  | `/api/v1/courses/:id/my-grades`           | S           | My marks and total                           |

### Payments (manual UPI)

| Method       | Path                                           | Who | What                                                 |
| ------------ | ---------------------------------------------- | --- | ---------------------------------------------------- |
| GET / POST   | `/api/v1/courses/:id/payments`                 | S   | Where to pay + my latest report / report a UTR       |
| POST         | `/api/v1/payments/proofs`                      | S   | Presigned PUT for a screenshot                       |
| GET          | `/api/v1/payment-qr?v=`                        | any | Redirect to the school's QR code                     |
| GET / PUT    | `/api/v1/admin/payment-settings`               | A   | UPI ID, number, payee name, instructions             |
| POST         | `/api/v1/admin/payment-settings/qr/uploads`    | A   | Presigned PUT for the QR image                       |
| PUT / DELETE | `/api/v1/admin/payment-settings/qr`            | A   | Record / remove the QR image                         |
| GET          | `/api/v1/admin/payments?status=`               | A   | Reported payments                                    |
| GET          | `/api/v1/admin/payments/csv?from=&to=&status=` | A   | CSV of payments reported between two dates (audited) |
| PATCH        | `/api/v1/admin/payments/:id`                   | A   | `{ decision, note? }`: approve (enrols) / reject     |
| GET          | `/api/v1/admin/payments/:id/proof`             | A   | Redirect to the screenshot                           |

### People, parents, notifications, settings

| Method     | Path                                 | Who | What                                             |
| ---------- | ------------------------------------ | --- | ------------------------------------------------ |
| GET / POST | `/api/v1/admin/users`                | A   | Search / add people (emails a set-password link) |
| PATCH      | `/api/v1/admin/users/:id`            | A   | Role, switch off/on                              |
| POST       | `/api/v1/admin/users/:id/invite`     | A   | Resend the invite                                |
| POST       | `/api/v1/admin/users/:id/restore`    | A   | Cancel a deletion request                        |
| POST       | `/api/v1/admin/users/:id/children`   | A   | Link a parent to a student                       |
| DELETE     | `/api/v1/admin/parent-links/:id`     | A   | Unlink                                           |
| GET / PUT  | `/api/v1/admin/settings`             | A   | `{ dailyGoalMinutes }`                           |
| GET        | `/api/v1/children`                   | P   | Linked children                                  |
| GET        | `/api/v1/children/:id`               | P   | One child's progress, grades, attendance         |
| GET        | `/api/v1/notifications?before=`      | any | Mine, newest first, 50 per page                  |
| GET        | `/api/v1/notifications/unread-count` | any | `{ unread }` (the bell polls this)               |
| PATCH      | `/api/v1/notifications/:id`          | any | Mark read; returns its link                      |
| POST       | `/api/v1/notifications/read-all`     | any | Mark all read                                    |

## Not done yet

- An OpenAPI document generated from the zod schemas (so clients can be generated). Until then this page and
  the handler doc comments are the reference.
