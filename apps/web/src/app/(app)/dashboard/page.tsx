import { formatInZone } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { CourseTile } from "@/components/course-tile";
import { Icon } from "@/components/icons";
import { ChildCard, NoChildren } from "@/components/child-card";
import { JoinButton } from "@/components/join-button";
import { MonthlyProgress, TodayProgress } from "@/components/learner-progress";
import { ProgressRing } from "@/components/progress-ring";
import { buttonClasses } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import type { Actor } from "@/server/deps";
import { listClasses } from "@/server/services/classes";
import { isGoogleConnected } from "@/server/services/courses";
import { listChildren } from "@/server/services/parents";
import { getLearnerOverview, listMyCourses, type CourseCard } from "@/server/services/learning";

export const metadata: Metadata = { title: "Overview" };

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
  const [classes, googleOk, overview, courses, children] = await Promise.all([
    listClasses(d, actor, {
      from: new Date(now.getTime() - 3 * 3600_000),
      to: new Date(now.getTime() + 7 * 86_400_000),
    }),
    actor.role === "TEACHER" ? isGoogleConnected(d, actor.id) : Promise.resolve(true),
    actor.role === "STUDENT"
      ? getLearnerOverview(d, actor, { month: typeof month === "string" ? month : undefined })
      : Promise.resolve(null),
    actor.role === "TEACHER" || actor.role === "ADMIN" ? listMyCourses(d, actor) : Promise.resolve([]),
    actor.role === "PARENT" ? listChildren(d, actor) : Promise.resolve(null),
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
              <MonthlyProgress month={overview.month} basePath="/dashboard" />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-7">{upcomingSection}</div>
        </div>
      ) : (
        <>
          {children && (
            <section aria-labelledby="children-h">
              <h2 id="children-h" className="mb-3 font-display text-xl font-bold">
                Your children
              </h2>
              {children.length === 0 ? (
                <NoChildren />
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {children.map((c) => (
                    <ChildCard key={c.id} child={c} />
                  ))}
                </div>
              )}
            </section>
          )}
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
              <Link
                href={`/courses/${course.id}/lessons/${course.next.lessonId}`}
                className={buttonClasses("primary", "min-w-48")}
              >
                {course.next.resume ? "Continue learning" : "Start learning"}
                <Icon name="arrowRight" size={18} />
              </Link>
            </div>
          </div>
        </article>
      ) : (
        <div className={`p-6 text-muted ${card}`}>
          {course === null
            ? "No lessons yet. Join a course, or check back after your first class."
            : "You've finished every lesson so far. New recordings will show up here."}
          <Link href="/courses" className="ml-1 font-semibold text-primary-fg">
            See my courses
          </Link>
        </div>
      )}
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
        <Link href="/calendar" className="text-sm font-semibold text-primary-fg">
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
                  {c.location && ` · ${c.location}`}
                </span>
              </span>
              {c.canManage && new Date(c.startsAt) <= new Date() && (
                <Link href={`/classes/${c.id}/attendance`} className={buttonClasses("secondary")}>
                  Take attendance
                </Link>
              )}
              {actor.role !== "PARENT" &&
                (c.online ? (
                  <JoinButton
                    classId={c.id}
                    startsAt={c.startsAt}
                    endsAt={c.endsAt}
                    timeZone={actor.timezone}
                  />
                ) : (
                  <span className="text-sm text-muted">In person</span>
                ))}
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
        <Link href="/courses" className="text-sm font-semibold text-primary-fg">
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
