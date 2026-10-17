import { formatInZone } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CourseTile } from "@/components/course-tile";
import { Icon } from "@/components/icons";
import { ChildCard, NoChildren } from "@/components/child-card";
import { JoinButton } from "@/components/join-button";
import { MonthlyProgress, TodayProgress } from "@/components/learner-progress";
import { ProgressRing } from "@/components/progress-ring";
import { buttonClasses } from "@/components/ui/button";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import type { Actor } from "@/server/deps";
import { listClasses } from "@/server/services/classes";
import { isGoogleConnected } from "@/server/services/courses";
import { listChildren } from "@/server/services/parents";
import { mayJoinRecordedClasses } from "@/server/services/recording-consent";
import { getLearnerOverview, listMyCourses, type CourseCard } from "@/server/services/learning";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Dashboard"))("title") };
}

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
  const [classes, googleOk, overview, courses, children, mayJoin, t] = await Promise.all([
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
    mayJoinRecordedClasses(d.db, actor),
    getTranslations("Dashboard"),
  ]);
  const upcoming = classes.filter((c) => new Date(c.endsAt) > now).slice(0, 8);
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: actor.timezone }).format(
      now,
    ),
  );
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const upcomingSection = (
    <UpcomingClasses actor={actor} upcoming={upcoming} compact={!!overview} mayJoin={mayJoin} />
  );

  return (
    <div className="flex max-w-6xl flex-col gap-7">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          {t("greeting", { part, name: actor.name.split(" ")[0] ?? "" })}
        </h1>
        <p className="mt-1 text-muted">
          {upcoming.length ? t("upcomingCount", { count: upcoming.length }) : t("noClasses")}
        </p>
      </header>

      {!googleOk && (
        <section className={`flex flex-wrap items-center gap-4 p-5 ${card}`} aria-label={t("googleLabel")}>
          <p className="flex-1">{t.rich("googleText", { b: (chunks) => <b>{chunks}</b> })}</p>
          <a href="/api/v1/google/connect?returnTo=/dashboard" className={buttonClasses("primary")}>
            {t("connectGoogle")}
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
                goalMinutes={overview.goalMinutes}
                questions={overview.questionsToday}
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
                {t("yourChildren")}
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
  const t = useTranslations("Dashboard");
  return (
    <section aria-labelledby="resume-h">
      <SectionTitle id="resume-h">
        {course?.next?.resume ? t("resumeLearning") : t("startLearning")}
      </SectionTitle>
      {course?.next ? (
        <article className={`flex flex-col gap-5 p-4 sm:flex-row sm:items-stretch ${card}`}>
          <CourseTile
            title={course.title}
            grade={course.grade}
            color={course.color}
            cover={{ courseId: course.id, version: course.coverVersion }}
            className="h-36 sm:w-60"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted">{course.title}</p>
                <h3 className="mt-1 text-lg font-bold">{t("lesson", { title: course.next.title })}</h3>
              </div>
              <ProgressRing
                value={course.percent}
                size={48}
                stroke={5}
                label={t("lessonsRing", { done: course.completedCount, total: course.lessonCount })}
              >
                <span className="text-[11px] font-bold">{course.percent}%</span>
              </ProgressRing>
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {t("lessonsDone", { done: course.completedCount, total: course.lessonCount })}
              </p>
              <Link
                href={`/courses/${course.id}/lessons/${course.next.lessonId}`}
                className={buttonClasses("primary", "min-w-48")}
              >
                {course.next.resume ? t("continueLearning") : t("startLearning")}
                <Icon name="arrowRight" size={18} />
              </Link>
            </div>
          </div>
        </article>
      ) : (
        <div className={`p-6 text-muted ${card}`}>
          {course === null ? t("noLessons") : t("allDone")}
          <Link href="/courses" className="ml-1 font-semibold text-primary-fg">
            {t("seeCourses")}
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
  mayJoin,
}: {
  actor: Actor;
  upcoming: UpcomingClass[];
  compact: boolean;
  /** Students: agreed to the class-recording notice. */
  mayJoin: boolean;
}) {
  const t = useTranslations("Dashboard");
  const locale = intlLocale(useLocale());
  return (
    <section className={`p-6 ${card}`} aria-labelledby="upcoming-h">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="upcoming-h" className="font-display text-xl font-bold">
          {t("upcoming")}
        </h2>
        <span className="flex gap-4">
          {actor.role === "STUDENT" && (
            <Link href="/recording-consent" className="text-sm font-semibold text-primary-fg">
              {t("recordings")}
            </Link>
          )}
          <Link href="/calendar" className="text-sm font-semibold text-primary-fg">
            {t("calendar")}
          </Link>
        </span>
      </div>
      {upcoming.length === 0 ? (
        <p className="py-6 text-muted">{t("nothingUpcoming", { role: actor.role })}</p>
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
                  {c.course.title} · {formatInZone(new Date(c.startsAt), actor.timezone, locale)}
                  {c.location && ` · ${c.location}`}
                </span>
              </span>
              {c.canManage && new Date(c.startsAt) <= new Date() && (
                <Link href={`/classes/${c.id}/attendance`} className={buttonClasses("secondary")}>
                  {t("takeAttendance")}
                </Link>
              )}
              {actor.role !== "PARENT" &&
                (c.online ? (
                  <JoinButton
                    classId={c.id}
                    startsAt={c.startsAt}
                    endsAt={c.endsAt}
                    timeZone={actor.timezone}
                    needsConsent={!mayJoin}
                  />
                ) : (
                  <span className="text-sm text-muted">{t("inPerson")}</span>
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TeachingCourses({ courses }: { courses: CourseCard[] }) {
  const t = useTranslations("Dashboard");
  return (
    <section className={`p-6 ${card}`} aria-labelledby="teaching-h">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="teaching-h" className="font-display text-xl font-bold">
          {t("yourCourses")}
        </h2>
        <Link href="/courses" className="text-sm font-semibold text-primary-fg">
          {t("allCourses")}
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
                  {t("courseCounts", { students: c.studentCount, lessons: c.lessonCount })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
