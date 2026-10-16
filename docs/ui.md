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
call-back bar and the profile-completion nag. They are marketing patterns for adult upskilling. We serve K-12
students who are minors (DPDP Act), and referral or marketing prompts aimed at them are inappropriate.

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
- **Parent:** upcoming classes for their verified children, read-only, with no Join button.

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

### Course (`/courses/:courseId`)

- The header shows the cover, teacher and student count. Students also get a progress bar
  (`role="progressbar"`).
- Lessons are numbered and marked completed (check), partly watched ("45% watched") or untouched.
- Staff also see videos that are still processing or that failed, so they know what students can't see yet.
- Access follows the same rule as video playback (`assertCourseAccess(..., "watch")`). Anyone else gets a
  plain 404.

Until lessons CRUD exists, a course's lessons are its READY videos in upload order.

### Lesson (`/library/:videoId`)

A back link to the course, then the HLS player with resume and speed controls.

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
