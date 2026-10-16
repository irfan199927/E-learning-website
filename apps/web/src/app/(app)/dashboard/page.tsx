import { formatInZone } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { CourseTile } from "@/components/course-tile";
import { Icon } from "@/components/icons";
import { JoinButton } from "@/components/join-button";
import { ProgressRing } from "@/components/progress-ring";
import { buttonClasses } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import type { Actor } from "@/server/deps";
import { listClasses } from "@/server/services/classes";
import { isGoogleConnected } from "@/server/services/courses";
import {
  getLearnerOverview,
  listMyCourses,
  type CourseCard,
  type MonthActivity,
} from "@/server/services/learning";

export const metadata: Metadata = { title: "Overview" };

/** Daily watch-time goal shown on the "Today" ring. */
const DAILY_GOAL_MINUTES = 30;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const card = "rounded-[var(--radius-card)] border border-line bg-surface";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const actor = await requirePageActor();
  const { month } = await searchParams;
  const d = deps();
  const now = d.now();
  const [classes, googleOk, overview, courses] = await Promise.all([
    listClasses(d, actor, {
      from: new Date(now.getTime() - 3 * 3600_000),
      to: new Date(now.getTime() + 7 * 86_400_000),
    }),
    actor.role === "TEACHER" ? isGoogleConnected(d, actor.id) : Promise.resolve(true),
    actor.role === "STUDENT"
      ? getLearnerOverview(d, actor, { month: typeof month === "string" ? month : undefined })
      : Promise.resolve(null),
    actor.role === "TEACHER" || actor.role === "ADMIN" ? listMyCourses(d, actor) : Promise.resolve([]),
  ]);
  const upcoming = classes.filter((c) => new Date(c.endsAt) > now).slice(0, 8);
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: actor.timezone }).format(
      now,
    ),
  );
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const upcomingSection = <UpcomingClasses actor={actor} upcoming={upcoming} compact={!!overview} />;

  return (
    <div className="flex max-w-6xl flex-col gap-7">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Good {part}, {actor.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted">
          {upcoming.length
            ? `${upcoming.length} upcoming ${upcoming.length === 1 ? "class" : "classes"} this week`
            : "No classes in the next 7 days"}
        </p>
      </header>

      {!googleOk && (
        <section className={`flex flex-wrap items-center gap-4 p-5 ${card}`} aria-label="Google connection">
          <p className="flex-1">
            <b>Connect Google</b> to schedule classes with Meet links and get recordings automatically.
          </p>
          <a href="/api/v1/google/connect?returnTo=/dashboard" className={buttonClasses("primary")}>
            Connect Google
          </a>
        </section>
      )}

      {overview ? (
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-7">
            <ResumeLearning course={overview.resume} />
            <div className="grid gap-7 md:grid-cols-2">
              <TodayProgress
                seconds={overview.todaySeconds}
                lessonsCompleted={overview.lessonsCompleted}
                coursesInProgress={overview.coursesInProgress}
              />
              <MonthlyProgress month={overview.month} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-7">{upcomingSection}</div>
        </div>
      ) : (
        <>
          {upcomingSection}
          {courses.length > 0 && <TeachingCourses courses={courses} />}
        </>
      )}
    </div>
  );
}

function SectionTitle({ id, children, info }: { id: string; children: React.ReactNode; info?: string }) {
  return (
    <h2 id={id} className="mb-3 font-display text-xl font-bold">
      {children}
      {info && <span className="sr-only"> — {info}</span>}
    </h2>
  );
}

function ResumeLearning({ course }: { course: CourseCard | null }) {
  return (
    <section aria-labelledby="resume-h">
      <SectionTitle id="resume-h">{course?.next?.resume ? "Resume learning" : "Start learning"}</SectionTitle>
      {course?.next ? (
        <article className={`flex flex-col gap-5 p-4 sm:flex-row sm:items-stretch ${card}`}>
          <CourseTile
            title={course.title}
            grade={course.grade}
            color={course.color}
            className="h-36 sm:w-60"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted">{course.title}</p>
                <h3 className="mt-1 text-lg font-bold">Lesson: {course.next.title}</h3>
              </div>
              <ProgressRing
                value={course.percent}
                size={48}
                stroke={5}
                label={`${course.completedCount} of ${course.lessonCount} lessons completed`}
              >
                <span className="text-[11px] font-bold">{course.percent}%</span>
              </ProgressRing>
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {course.completedCount}/{course.lessonCount} lessons completed
              </p>
              <Link href={`/library/${course.next.videoId}`} className={buttonClasses("primary", "min-w-48")}>
                {course.next.resume ? "Continue learning" : "Start learning"}
                <Icon name="arrowRight" size={18} />
              </Link>
            </div>
          </div>
        </article>
      ) : (
        <div className={`p-6 text-muted ${card}`}>
          {course === null
            ? "No lessons yet. Recordings appear here after each class."
            : "You've finished every lesson so far. New recordings will show up here."}
          <Link href="/courses" className="ml-1 font-semibold text-primary">
            See my courses
          </Link>
        </div>
      )}
    </section>
  );
}

function TodayProgress({
  seconds,
  lessonsCompleted,
  coursesInProgress,
}: {
  seconds: number;
  lessonsCompleted: number;
  coursesInProgress: number;
}) {
  const minutes = Math.floor(seconds / 60);
  return (
    <section aria-labelledby="today-h" className="flex flex-col">
      <SectionTitle id="today-h">Today&apos;s progress</SectionTitle>
      <div className={`flex flex-1 flex-wrap items-center justify-around gap-6 p-6 ${card}`}>
        <ProgressRing
          value={(minutes / DAILY_GOAL_MINUTES) * 100}
          size={132}
          stroke={12}
          color="var(--color-primary)"
          label={`${minutes} of ${DAILY_GOAL_MINUTES} minutes watched today`}
        >
          <span className="flex flex-col">
            <b className="text-2xl">{minutes}</b>
            <span className="text-xs text-muted">
              of {DAILY_GOAL_MINUTES} min
              <br />
              watched
            </span>
          </span>
        </ProgressRing>
        <dl className="flex flex-col gap-4">
          <div>
            <dt className="text-xs text-muted">Lessons completed</dt>
            <dd className="text-2xl font-bold">{lessonsCompleted}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Courses in progress</dt>
            <dd className="text-2xl font-bold">{coursesInProgress}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function MonthlyProgress({ month }: { month: MonthActivity }) {
  const navLink =
    "grid size-9 place-items-center rounded-full text-ink hover:bg-canvas aria-disabled:pointer-events-none aria-disabled:opacity-30";
  return (
    <section aria-labelledby="month-h" className="flex flex-col">
      <SectionTitle id="month-h">Monthly progress</SectionTitle>
      <div className={`flex-1 p-5 ${card}`}>
        <div className="mb-3 flex items-center justify-center gap-4">
          <Link href={`/dashboard?month=${month.prev}`} className={navLink} aria-label="Previous month">
            <Icon name="chevronLeft" size={18} />
          </Link>
          <p className="min-w-36 text-center font-bold" aria-live="polite">
            {month.label}
          </p>
          {month.next ? (
            <Link href={`/dashboard?month=${month.next}`} className={navLink} aria-label="Next month">
              <Icon name="chevronRight" size={18} />
            </Link>
          ) : (
            <span className={navLink} aria-disabled="true" aria-hidden="true">
              <Icon name="chevronRight" size={18} />
            </span>
          )}
        </div>
        <table className="w-full table-fixed text-center">
          <caption className="sr-only">
            Days with lesson time in {month.label}: {month.activeDays}
          </caption>
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w} scope="col" className="pb-2 text-[11px] font-semibold uppercase text-muted">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {month.weeks.map((week, i) => (
              <tr key={i}>
                {week.map((c, j) => (
                  <td key={j} className="p-0.5">
                    {c && (
                      <span
                        className={`mx-auto grid size-8 place-items-center rounded-full text-xs ${
                          c.seconds > 0
                            ? "bg-success font-bold text-white"
                            : c.isFuture
                              ? "text-muted/50"
                              : "border border-dashed border-line-strong text-muted"
                        } ${c.isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : ""}`}
                      >
                        {c.day}
                        <span className="sr-only">
                          {c.isToday ? " (today)" : ""}
                          {c.seconds > 0 ? `: ${Math.max(1, Math.round(c.seconds / 60))} min watched` : ""}
                        </span>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-center text-xs text-muted">
          {month.activeDays} {month.activeDays === 1 ? "day" : "days"} of learning this month
        </p>
      </div>
    </section>
  );
}

type UpcomingClass = Awaited<ReturnType<typeof listClasses>>[number];

function UpcomingClasses({
  actor,
  upcoming,
  compact,
}: {
  actor: Actor;
  upcoming: UpcomingClass[];
  compact: boolean;
}) {
  return (
    <section className={`p-6 ${card}`} aria-labelledby="upcoming-h">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="upcoming-h" className="font-display text-xl font-bold">
          Upcoming classes
        </h2>
        <Link href="/calendar" className="text-sm font-semibold text-primary">
          Calendar
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <p className="py-6 text-muted">
          {actor.role === "TEACHER"
            ? "Nothing scheduled. Schedule your first class from the Calendar."
            : "You're all caught up."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {upcoming.map((c) => (
            <li key={c.id} className={`flex flex-wrap items-center py-3 ${compact ? "gap-3" : "gap-4"}`}>
              <span
                className="w-1.5 self-stretch rounded-full"
                style={{ background: c.course.color }}
                aria-hidden="true"
              />
              <span className={`flex flex-1 flex-col ${compact ? "min-w-40" : "min-w-48"}`}>
                <b className="text-[15px]">{c.title}</b>
                <span className="text-sm text-muted">
                  {c.course.title} · {formatInZone(new Date(c.startsAt), actor.timezone)}
                </span>
              </span>
              {actor.role !== "PARENT" && (
                <JoinButton
                  classId={c.id}
                  startsAt={c.startsAt}
                  endsAt={c.endsAt}
                  timeZone={actor.timezone}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TeachingCourses({ courses }: { courses: CourseCard[] }) {
  return (
    <section className={`p-6 ${card}`} aria-labelledby="teaching-h">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="teaching-h" className="font-display text-xl font-bold">
          Your courses
        </h2>
        <Link href="/courses" className="text-sm font-semibold text-primary">
          All courses
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {courses.slice(0, 4).map((c) => (
          <li key={c.id}>
            <Link
              href={`/courses/${c.id}`}
              className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-canvas"
            >
              <span
                className="size-10 shrink-0 rounded-lg"
                style={{ background: c.color }}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-col">
                <b className="truncate text-[15px]">{c.title}</b>
                <span className="text-sm text-muted">
                  {plural(c.studentCount, "student")} · {plural(c.lessonCount, "lesson")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
