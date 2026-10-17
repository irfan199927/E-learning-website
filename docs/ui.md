# UI guide — app shell and learner screens

How the signed-in app is laid out, what each screen shows per role, and the rules to follow when adding
screens. Colours, type and radii are the design tokens in `apps/web/src/app/globals.css`. Change them there
only.

## Where the layout came from

The October 2026 redesign borrowed layout patterns from consumer learning apps the product owner shared
(reference screenshots of an online-course platform). We took the **patterns** and kept our own brand, copy
and artwork.

| Pattern from the reference                       | What we built                                                                  | Notes                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Left sidebar with icons and a filled active pill | `ShellFrame` sidebar (desktop) / slide-in drawer (mobile)                      | Same `<nav>` element for both, so there is one source of truth |
| Streak counter in the top bar                    | "N Days streak" with flame (students only)                                     | From `LearningDay`; see [Streak rules](#streak-rules)          |
| Avatar initials top right                        | Initials + name + role + sign-out                                              |                                                                |
| "Resume learning" card                           | Overview → Resume/Start learning card                                          | Course cover, next lesson, X/Y lessons, ring, CTA              |
| "Today's progress" rings                         | Minutes watched today vs a 30-min goal, lessons completed, courses in progress | "Questions attempted" waits for quizzes (backlog)              |
| "Monthly progress" calendar                      | Month grid, Monday-first; green = a day with lesson time                       | Prev/next month are plain links (`?month=YYYY-MM`)             |
| "My courses" with All / Completed / In progress  | `/courses` with filter chips (`?filter=`) and per-course progress              | Start / Resume / Review CTA follows the course state           |
| Course thumbnails                                | `CourseTile`: generated cover in the course colour                             | No image uploads needed; decorative (`aria-hidden`)            |

**Deliberately not adopted:** Refer & Earn, Career services, masterclass "Register" banners, counsellor
call-back bar and the profile-completion nag. They are marketing patterns for adult upskilling. A school's
learners don't need referral or marketing prompts inside their coursework.

## App shell

`components/app-shell.tsx` is a server component: it reads the streak and renders the top-bar content. It
wraps `components/shell-frame.tsx`, a client component that owns the drawer state and the role-filtered nav
list.

- **Desktop (≥ 768 px):** sticky 256 px sidebar plus a sticky 64 px top bar.
- **Mobile:** the menu button (`aria-expanded`, `aria-controls="main-nav"`) slides the sidebar in over a
  backdrop. It closes on navigation, Escape (focus returns to the menu button) or a tap on the backdrop.
  While closed, the drawer is `invisible`, so its links are out of the tab order and the accessibility tree.
- **Active item:** `aria-current="page"`. "My courses" also lights up on lesson pages (`/library/:id`).

| Nav item     | Path              | Roles                                             |
| ------------ | ----------------- | ------------------------------------------------- |
| Overview     | `/dashboard`      | all                                               |
| My courses   | `/courses`        | student ("Courses" for teacher/admin), not parent |
| My children  | `/children`       | parent                                            |
| Calendar     | `/calendar`       | all                                               |
| Upload video | `/library/upload` | teacher, admin                                    |

## Screens

### Overview (`/dashboard`)

- **Student:**
  - Resume learning card: the most recently active course that isn't finished. Its lesson is the one in
    progress, or else the first one not yet completed.
  - Today's progress.
  - Monthly progress.
  - Upcoming classes in the right column (below the other cards on narrow screens).
- **Teacher and admin:** the Connect Google prompt (when there is no grant), upcoming classes with Join
  buttons, and "Your courses" (student and lesson counts).
- **Parent:** **Your children** (one card per linked child: streak, today's minutes, lessons done, courses, and
  **See progress**), then upcoming classes for their children, read-only, with no Join button.

### Notifications (bell, `/notifications`)

- Every signed-in page has a bell in the top bar. Its accessible name says "Notifications, 3 unread"; the red
  badge shows up to "9+". The count comes with the page, then `components/notification-bell.tsx` re-checks it
  (`/api/v1/notifications/unread-count`) on every page change, every minute while the tab is visible, and when the
  tab comes back.
- `/notifications` lists the newest 50 (then **Older**): unread ones are bold with a dot (and "(unread)" for
  screen readers). Opening one marks it read and follows its link; **Mark all as read** clears the rest.
- What creates them: join requests (to the teacher), approvals and declines, grades, new assignments and quizzes
  (to the course's students, once per item), class reminders, and recording problems (to the
  host), payments (to admins; approvals and rejections to the student). Links are always same-site paths.
- Read notifications are deleted after 90 days, unread ones after a year (worker job `prune-notifications`).

### Assignments (`/assignments/:id`; new at `/courses/:id/assignments/new`)

- The course page has an **Assignments** section (due date and status: To do, Handed in, Handed in late, Not
  handed in, Graded n/m; staff see "n handed in · m graded" and drafts) with **New assignment** for staff.
- **Create / edit:** title, instructions, due date (teacher's clock), points, what students hand in (a written
  answer, files, or both), **Accept late work**, **Visible to students**. Edit also has **Delete…**.
- **Student:** instructions, then **Your work**: an answer box and/or files (up to 5, 25 MB each, uploaded straight
  to storage with a `role="status"` line), **Hand in** / **Hand in again** until graded. After the due date it
  says the work will be marked late, or that it's closed. Once graded: score, feedback, and what they handed in.
- **Teacher:** every student with a status pill, the written answer (collapsed), files, and a **Grade** form
  (score out of the points, feedback). Saving tells the student in the app.

### Quizzes (`/quizzes/:id`; new at `/courses/:id/quizzes/new`, edit at `/quizzes/:id/edit`)

- **Quizzes** section on the course page (questions, time limit, closing date, best score / "taken by n").
- **Editor:** title, time limit (minutes, empty = none), attempts allowed, closing date, shuffle, visible; then
  questions: text, 2–6 options with a "correct" checkbox each (one or more), points, move up/down, delete. Once a
  student has submitted, questions are read-only (settings still save).
- **Taking:** **Start quiz** → questions as radio buttons (one answer) or checkboxes ("choose all that apply"),
  a countdown pinned at the top (announced once a minute, red under a minute), auto-submit at zero, and a
  confirmation when questions are unanswered.
- **Result:** score, attempts used, each question marked Right / Wrong with the student's choice; the correct
  answers appear once they have no attempts left (or the quiz closed).
- **Teacher:** a results table (best score, attempts, last attempt per student).
- Parents see graded assignments and best quiz scores under **Grades** on their child's page.

### Grades (`/courses/:id/grades`)

- **Teacher / admin (Gradebook):** one row per enrolled student, one column per published assignment or quiz
  (soonest due first; quizzes without a closing date last), then the total. Cells: the score (quizzes: best
  attempt; "late" when handed in late), **To grade** (links to the assignment), **Missing** (overdue, nothing
  handed in), or "—" (not due yet). A class average row at the bottom. The table scrolls sideways inside its card
  with the student column pinned. **Download CSV** exports the same data with emails (audited).
- **Student (My grades):** their total so far and each piece of work with its status, linked from the course page.
- **Excuse** on a Missing cell (and **Undo** on an Excused one) leaves that work out for that student.
  **Weighting** (below the table): by points, or assignments X% / quizzes the rest.
- Totals: graded work counts its score; overdue work never handed in counts as 0; excused work is left out; work waiting to be graded and
  work not due yet are left out (`gradeTotal` in `packages/core/src/gradebook.ts`).
- Entry points: **Gradebook** button on the course page header (staff); **My grades** link under the progress bar
  (students, once the course has work).

### Class recordings (`/recording-consent`, students)

- The recording notice (`RECORDING_NOTICE` in `packages/core/src/recording.ts`), the student's answer, and **I agree**
  or **Withdraw my agreement**.
- Until a student answers (or after the notice text changes) a banner above every page says "Live classes are
  recorded" with **Read the notice**. It isn't shown on the notice page itself, or after they withdraw.
- Without an agreement, the dashboard's Join button reads **Agree to recording to join** and goes to the notice;
  the server refuses the join too. A **Recordings** link in the Upcoming classes header leads back to the page.
- Teachers see a "Not agreed to recording" badge per student on the attendance sheet, and a count above it for
  online classes.

### Calendar: scheduling without Google

- **Schedule class** is always there for teachers. With Google connected, the form asks **Where**: Google Meet
  (Calendar invite, Meet link, recording afterwards) or **A room or another link**. Without Google (or on a
  school with Google switched off) only the second applies: **Room or place** and/or a **Meeting link** (any
  https link; students open it from 10 minutes before, like Meet).
- Classes without Google repeat weekly too (expanded by the app), can be dragged to reschedule and cancelled.
- Students and parents see the room on the Overview; an in-person class shows "In person" instead of **Join**.
- Clicking a class that has started opens its attendance (teachers); an upcoming one opens its meeting link.

### Attendance (`/classes/:classId/attendance`, the host, the course teacher and admins)

- Every student in the course with **Present** / **Absent** (a radio pair per student, named by the student),
  **Mark everyone present**, and **Save attendance**. Each row says whether the mark came from Google Meet (with
  minutes) or a teacher.
- Saving is only possible once the class has started; cancelled classes have nothing to take.
- A teacher's mark always wins: the Meet sync never overwrites it. Parents see the marks on their child's page.
- Reached from the course page's **Attendance** section (recent classes, "Not taken" / "n of m present"), the
  Overview's upcoming list (**Take attendance** on a class in progress), and the Calendar.

### My children (`/children`, `/children/:childId`, parents)

- `/children` lists the same child cards as the Overview, or explains how children get linked.
- A child's page is read-only and shows the numbers the child sees: streak, **Today's progress**, **Monthly
  progress** (browsable by month), each course's progress (lessons done, state, last active), and **Live
  classes, last 30 days** with Attended / Missed / Not recorded (attendance comes from Google Meet).
- Any child id that isn't the parent's own verified child is a plain 404.
- Parents get linked to a student by an admin on the Users page (**Link a student** by email; **Unlink**).

### My courses (`/courses`)

There is one card per visible course (`visibleCoursesWhere`).

Students see:

- the teacher;
- the next lesson;
- `completed/total` with a ring;
- a CTA: **Start learning** (not started), **Resume learning** (in progress, primary), or **Review course**
  (completed).

Filter chips are links, so filtered views can be bookmarked and work without JavaScript. Teachers see the
student count and an **Open course** CTA. Parents are redirected to the Overview.

**Find a course** (students only, below their own courses):

- It lists published courses the student isn't in yet (alphabetical, the first 60), each with **Ask to join**.
- **Search courses** (`?q=`) matches the title, description or teacher's name; **Clear** resets it.
- After asking, the card shows "Request sent. Waiting for your teacher." If the request was declined, it shows
  **Ask again**.
- Course content stays closed (404) until the teacher approves.

Teachers get a **New course** button (`/courses/new`: title, optional grade and description). New courses are
published at once. A badge on each course, such as "2 students waiting to join", links to that course's requests.

### Course (`/courses/:courseId`)

- The header shows the cover, teacher and student count. Students also get a progress bar
  (`role="progressbar"`).
- Lessons are grouped by module, in the teacher's order, and numbered across the course. Each row shows its type
  (Video, Reading, Link, Files), how many files it has, and whether it's completed (check), partly watched
  ("45% watched") or untouched.
- Staff also see hidden lessons and videos still processing or that failed, unnumbered, so they know what students
  can't see yet. They get **Edit course** and **Upload video** in the header.
- Access follows the same rule as video playback (`assertCourseAccess(..., "watch")`). Anyone else gets a
  plain 404.
- The course teacher and admins see **Join requests** (`#join-requests`): who asked, when, and their note, with
  **Approve** and **Decline**. Approving enrols the student and sends them an in-app notification.

- Staff also see **Students (n)**: everyone enrolled, with **Remove** (asks to confirm). Removing ends access at
  once; the student can ask to join again.

### Users (`/admin/users`, admins only)

- **Add people:** one person (name, email, role), or **From a spreadsheet**, a CSV with an `email,name[,role]`
  header and up to 500 rows.
  - The file is checked in the browser first: bad and duplicate lines are listed with line numbers before
    anything is sent.
  - Existing emails are skipped, never changed.
  - Each new person gets a "Welcome, choose a password" email. Nobody types or shares passwords.
- **Search** by name or email, and filter by role. Pages hold 50 people; the search is a plain GET form, so
  results can be bookmarked.
- **Per person:**
  - a role picker that saves on change;
  - **Switch off / Switch on**: switching off signs them out everywhere at once;
  - **Resend invite** for accounts that never set a password (invite links expire after an hour).
- **Guard rails:** you can't change your own role or switch yourself off, and the last active admin can't be
  demoted.

### Lesson (`/courses/:courseId/lessons/:lessonId`)

- A back link to the course; staff also get **Edit lesson** and a note when the lesson is hidden.
- Video lessons: the HLS player with resume and speed controls. A video still processing shows a placeholder.
- Readings show their text (plain text, line breaks kept). Links open in a new tab (`rel="noopener noreferrer"`).
- **Files** lists attachments with their size; each downloads through `/api/v1/attachments/:id`.
- Students tick readings, links and file lessons with **Mark as done** (`aria-pressed`). Videos complete by
  watching 95%.
- **Previous / Next** follow the course order, skipping lessons students can't see.
- `/library/:videoId` still exists for staff to preview a video that isn't in a lesson; otherwise it redirects
  to the lesson.

### Edit course (`/courses/:courseId/edit`, the course teacher and admins)

- **Modules and lessons:** add, rename, move up/down and delete modules (only empty ones, so no lessons are lost);
  add lessons per module (Reading, Link, Files, or Video, which goes to the upload page with the module
  preselected); move lessons up/down, **Hide** / **Show**, delete (asks to confirm; a video lesson's video is
  kept).
- **Videos not in a lesson** lists course videos without a lesson, with **Add as lesson** into a chosen module.
- **Course details:** title, grade, description, card colour (six presets that pass contrast with white text) and
  **Listed in Find a course**.
- **Cover image:** upload a JPEG, PNG or WebP (≤ 2 MB) to replace the colour tile everywhere the course appears
  (catalog, My courses, course page, Resume card); **Remove cover** goes back to the tile.
- **Drag and drop** a lesson onto another to move it there (mouse; the drop is announced). Keyboard and
  screen-reader users use **Move up** / **Move down**; both save the same way.
- **Readings and instructions are Markdown** (bold, italics, headings, lists, links, tables). Each text box has a
  **Preview** toggle and a one-line formatting hint; `components/markdown.tsx` renders it and never renders raw
  HTML or `javascript:` links.
- **Replace video** (Edit lesson, video lessons): uploads a new video for the lesson. Students keep the old one
  until the new one is processed; the old video then appears under "Videos not in a lesson" for deleting.
- Every control is a labelled button (icon buttons have names like "Move Worksheet up"), 44 px square.

### Edit lesson (`/courses/:courseId/lessons/:lessonId/edit`)

- Title, text or instructions, web address (links), module (moving puts the lesson at the end) and **Visible to
  students**.
- **Files:** pick one or more files; each uploads straight to storage, with progress in a `role="status"` line.
  PDF, Office, OpenDocument, text, CSV, images or zip, up to 50 MB, 20 per lesson.

### Payments (`/admin/payments`, admins) and paying for a course (`/courses/:id/pay`, students)

- **Admin → Payments:** reported payments in three tabs (**To check**, **Approved**, **Rejected**), each with the
  student, course, amount, UPI reference, note and **View screenshot**; **Approve** enrols the student,
  **Reject** asks for a reason the student sees. Below: **Where students pay** (UPI ID, UPI number, the name
  students see, instructions) and **QR code** (upload, replace, remove).
- **Edit course → Price** (admins only): whole rupees; 0 makes the course free again.
- **Catalog:** a paid course shows its price and **Pay and join** instead of **Ask to join** (or "Payment sent.
  Waiting for the school to confirm.", or "Payment not confirmed: try again").
- **Pay page:** 1. the UPI ID / number, name, amount, the QR code and **Open my UPI app** (a `upi://pay` link with
  the amount filled in, for phones); 2. **UPI reference (UTR)**, an optional screenshot and note, then
  **I've paid: send for checking**. While it waits the form is replaced by the report; a rejection shows the
  reason above the form.

### Account (`/account`, everyone; the name and avatar in the top bar link here)

- Your details (name, email, role, how you sign in, joined date). Name and email changes go through an admin.
- Students: a link to **Class recordings**.
- **Delete my account** (students and parents): what happens is listed first (signed out at once, data deleted
  for good after 30 days, an admin can cancel until then, recordings may still show you). The button stays
  disabled until the person types `DELETE`. Afterwards they land on the sign-in page with a notice, and get an
  email with the date. Teachers and admins see that an admin deletes their accounts.
- Admins see "Deleting on …" and **Cancel deletion** for such accounts on the Users page (nothing else can be
  changed until it's cancelled).

## Installable app (PWA)

- `app/manifest.ts` + `public/icons/*` make the app installable ("Add to Home screen"); it opens on `/dashboard`.
- `public/sw.js` (registered by `components/register-sw.tsx` in production) shows `/offline` when a page can't
  load, and caches only `/_next/static` assets and icons. Bump its `CACHE` name to drop old caches.

## Landing page (`/`)

The public front page advertises a course. Visitors who click **Enroll now** go to
`/sign-in?next=/courses`; after signing in they land on My courses. Visitors who are already signed in see **Go to
dashboard** instead. The signed-in app keeps its own design system; the landing page is scoped under `.lp`.

| Piece                                                                                 | File                                                                                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Page (server component; plain HTML for SEO)                                           | `apps/web/src/app/(marketing)/page.tsx`                                             |
| Course copy: **sample** "Code Foundations" coding course, the only place to edit text | `apps/web/src/app/(marketing)/course.ts`                                            |
| Styles, tokens and motion                                                             | `apps/web/src/app/(marketing)/landing.css`                                          |
| Hero: scroll-driven camera through the word CODE                                      | `src/components/landing/hero-portal.tsx` wraps `src/components/ui/glyph-portal.tsx` |
| Scroll reveal, typing editor, sticky header                                           | `src/components/landing/{reveal,typing-terminal,site-header}.tsx`                   |

**Design direction.** The dark theme comes from the ui-ux-pro-max skill's design-system search for "coding bootcamp developer
course teens":

- a dark "terminal" style;
- JetBrains Mono for headings and Figtree for body text, both already self-hosted;
- one green accent (`#22C55E`, with dark text on it) reserved for actions.

We skipped the skill's testimonial carousel: we have no real testimonials, and invented ones would be fake reviews.
The projects students build serve as the proof instead.

**Glyph Portal** (MIT, © Christian Katzmann; keep the notice):

- **Fonts.** It measures the letters once when it mounts, so `HeroPortal` waits for our self-hosted mono font (1.6 s
  timeout, then a system font). Never point it at a third-party font URL: the CSP blocks it, and so does our rule
  of self-hosting every font.
- **Placement.** The component exposes `--gp-word-top` and `--gp-word-bottom`. The eyebrow and the CTA block are
  positioned from them.
- **Overriding its styles.** Its injected `<style>` comes later in the document than our CSS, so an override needs
  higher specificity (e.g. `.lp .lp-portal [data-gp-content]`).

**Motion rules.** These follow the skill's UX guidelines:

- Only 1–2 key animations per screen: the portal, the typing editor, staggered card entrances, a pulsing "live" dot
  and the technology marquee.
- Shared timing tokens: `--lp-dur-fast`, `--lp-dur`, `--lp-dur-slow` and `--lp-ease`.
- Hover and press feedback on every interactive element.
- **Reduced motion.** The portal renders statically, `Reveal` content is shown, the editor shows the finished program,
  and the marquee wraps instead of scrolling. This is tested in `e2e/landing.spec.ts`.
- **No JavaScript.** `Reveal` hides content only under `@media (scripting: enabled)`, so it never disappears for
  visitors without JavaScript.

## Themes (light / dark)

Every page has a theme switch: the landing page header, the app's top bar, and the sign-in pages.

- **Storage.** No choice means the site follows the OS (`prefers-color-scheme`). Clicking the switch stores
  `theme=light|dark` in a cookie for one year. The root layout reads it and renders `<html data-theme>`, so the
  server sends the right theme and there's no flash. This avoids an inline pre-hydration script, which the nonce CSP
  would also need to approve.
- **Hydration.** `ThemeToggle` (`src/components/theme-toggle.tsx`) renders both icons and lets CSS pick one, so the
  server HTML always matches the client. `aria-pressed` reports whether dark mode is on.
- **Switch animation.** Where the View Transitions API exists, the new theme grows as a circle from the button. With
  reduced motion it switches instantly.
- **CSS.** Dark values live in two identical blocks, `:root[data-theme="dark"]` and `@media (prefers-color-scheme:
dark) { :root:not([data-theme="light"]) }`. Change both together. This applies to the app (`globals.css`) and to the
  landing page (`landing.css`).
- **Brand blue as text.** Use `text-primary-fg` / `text-primary-fg-strong`, never `text-primary`: the brand blue is
  unreadable on dark surfaces. `bg-primary` (white text on blue) is fine in both themes.

**Landing page in each theme:**

- **Light** (product-launch style): white space, near-black heavy sans headlines (Figtree 900, tight tracking), one
  vivid blue → violet → pink → orange gradient (CODE letters, numbers, logo), soft-shadow 28 px cards, a frosted
  header, black pill buttons, and alternating `#f5f5f7` bands.
- **Dark:** the terminal look: JetBrains Mono headlines and a green action color.
- **Both:** the code editor stays dark. The hero re-mounts the portal with the matching font when the theme changes,
  because it measures the letters once at mount.

## Streak rules

These are pure functions in `packages/core/src/learning.ts`, unit-tested in `learning.test.ts`.

- A day counts once the learner has **any** watch time that day, on **their own clock** (`User.timezone`).
  01:30 IST on the 16th counts as the 16th, even though it is still the 15th in UTC.
- The streak counts consecutive active days ending today. If today has no activity yet, it ends yesterday
  instead, so a streak doesn't drop to 0 first thing in the morning.
- Watch time comes from the player's progress beacons (`watchedDeltaSeconds`, capped at 120 s per beacon).
  Scrubbing or leaving a paused tab open doesn't inflate it.
- The daily goal (30 min) is a UI constant in `dashboard/page.tsx`. Making it per-school is in
  `docs/NEXT_STEPS.md`.

## Rules for new screens

1. **Server components by default.** Fetch through a service (`server/services/*`), never Prisma directly.
   Pass only plain data to client components.
2. **Filters, tabs and pagination are links with search params**, not client state. This keeps them
   shareable, makes the back button work, and needs no JS.
3. **Touch targets are at least 44 px** (`h-11` or `size-11`). Text contrast meets WCAG AA in light and dark
   themes; use the semantic tokens (`text-muted`, `bg-surface` …), never raw hex values.
4. **Icons are decorative** (`components/icons.tsx`, `aria-hidden`). The control carries the accessible name.
   Progress rings get a text label ("3 of 9 lessons completed").
5. **Counts use `plural()`** (`lib/format.ts`) until i18n lands.
6. **Times are shown in the user's timezone**: pass `actor.timezone` to `formatInZone` / `JoinButton`.
7. Add a Playwright check to `e2e/smoke.spec.ts` for every new page. It runs as desktop and mobile
   (Pixel 7).
