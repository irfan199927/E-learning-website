import { formatInZone } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CourseTile } from "@/components/course-tile";
import { Icon, type IconName } from "@/components/icons";
import { ChildCard, NoChildren } from "@/components/child-card";
import { CountUp } from "@/components/count-up";
import { JoinButton } from "@/components/join-button";
import { MonthlyProgress, TodayProgress } from "@/components/learner-progress";
import { ProgressRing } from "@/components/progress-ring";
import { buttonClasses } from "@/components/ui/button";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import type { Actor } from "@/server/deps";
import { listClasses } from "@/server/services/classes";
import { getAttention, type Attention, type AttentionKey } from "@/server/services/attention";
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
  const staff = actor.role === "TEACHER" || actor.role === "ADMIN";
  const [classes, googleOk, overview, courses, children, mayJoin, attention, t] = await Promise.all([
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
    staff ? getAttention(d, actor) : Promise.resolve(null),
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
      {staff ? (
        <StaffHero
          admin={actor.role === "ADMIN"}
          greeting={t("greeting", { part, name: actor.name.split(" ")[0] ?? "" })}
          summary={upcoming.length ? t("upcomingCount", { count: upcoming.length }) : t("noClasses")}
          date={now}
          timeZone={actor.timezone}
        />
      ) : (
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {t("greeting", { part, name: actor.name.split(" ")[0] ?? "" })}
          </h1>
          <p className="mt-1 text-muted">
            {upcoming.length ? t("upcomingCount", { count: upcoming.length }) : t("noClasses")}
          </p>
        </header>
      )}

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
          {attention && <NeedsAttention attention={attention} />}
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

const ATTENTION_ICON: Record<AttentionKey, IconName> = {
  grade: "check",
  joinRequests: "users",
  attendance: "calendar",
  payments: "rupee",
  deletions: "trash",
};
/** One colour per kind of work, so a glance tells them apart (the soft chips stay light in both themes). */
const ATTENTION_TONE: Record<AttentionKey, string> = {
  grade: "bg-primary-soft text-primary-fg-strong",
  joinRequests: "bg-warning-soft text-warning",
  attendance: "bg-success-soft text-success",
  payments: "bg-warning-soft text-warning",
  deletions: "bg-live-soft text-live-fg",
};
const STAT_ICON = { students: "users", teachers: "teacher", courses: "courses" } as const;

type QuickKey = "schedule" | "upload" | "newCourse" | "users" | "payments";
const QUICK_ACTIONS: Record<"TEACHER" | "ADMIN", { key: QuickKey; href: string; icon: IconName }[]> = {
  TEACHER: [
    { key: "schedule", href: "/calendar", icon: "calendar" },
    { key: "upload", href: "/library/upload", icon: "upload" },
    { key: "newCourse", href: "/courses/new", icon: "plus" },
  ],
  ADMIN: [
    { key: "users", href: "/admin/users", icon: "users" },
    { key: "payments", href: "/admin/payments", icon: "rupee" },
    { key: "newCourse", href: "/courses/new", icon: "plus" },
  ],
};

/** Staff Overview header: greeting, today's date and the actions they reach for most. */
function StaffHero({
  admin,
  greeting,
  summary,
  date,
  timeZone,
}: {
  admin: boolean;
  greeting: string;
  summary: string;
  date: Date;
  timeZone: string;
}) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const today = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(date);
  return (
    <header className="relative isolate overflow-hidden rounded-[var(--radius-card)] bg-linear-135 from-primary to-primary-strong px-6 py-7 text-white md:px-8 md:py-9">
      {/* Decoration only: two soft rings, like the course covers. */}
      <span
        aria-hidden="true"
        className="absolute -right-16 -top-20 -z-10 size-64 rounded-full border-[40px] border-white/8"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-24 right-40 -z-10 size-48 rounded-full bg-white/6"
      />
      <p className="text-sm font-semibold text-white/80">{today}</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight md:text-4xl">{greeting}</h1>
      <p className="mt-1 text-white/85">{summary}</p>
      <nav aria-label={t("quickActions")} className="mt-6">
        <ul className="stagger flex flex-wrap gap-2">
          {QUICK_ACTIONS[admin ? "ADMIN" : "TEACHER"].map((a) => (
            <li key={a.key}>
              <Link
                href={a.href}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white/12 px-4 text-[15px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm transition-[background-color,transform] duration-200 hover:bg-white/20 active:scale-[0.97]"
              >
                <Icon name={a.icon} size={18} />
                {t(`quick.${a.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

/** Staff: what's waiting on them, each a link to the first place to act; admins also get school totals. */
function NeedsAttention({ attention }: { attention: Attention }) {
  const t = useTranslations("Dashboard");
  const { items, stats } = attention;
  return (
    <section aria-labelledby="attention-h" className="flex flex-col gap-4">
      <h2 id="attention-h" className="font-display text-xl font-bold">
        {t("attentionTitle")}
      </h2>
      {items.length === 0 ? (
        <p className={`flex items-center gap-3 p-5 text-muted ${card}`}>
          <span
            className="grid size-9 place-items-center rounded-full bg-success-soft text-success"
            aria-hidden="true"
          >
            <Icon name="check" size={18} />
          </span>
          {t("allCaughtUp")}
        </p>
      ) : (
        <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className={`lift group flex min-h-20 items-center gap-4 p-4 hover:border-primary ${card}`}
              >
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-2xl ${ATTENTION_TONE[item.key]}`}
                  aria-hidden="true"
                >
                  <Icon name={ATTENTION_ICON[item.key]} size={22} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-display text-3xl font-bold tabular-nums leading-tight">
                    <CountUp value={item.count} />
                  </span>
                  <span className="text-sm text-muted">
                    {t(`attention.${item.key}`, { count: item.count })}
                  </span>
                </span>
                <Icon
                  name="chevronRight"
                  size={18}
                  className="text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary-fg"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {stats && (
        <dl className="stagger grid grid-cols-3 gap-3">
          {(["students", "teachers", "courses"] as const).map((k) => (
            // dl > div may only hold dt/dd, so the icon sits inside the dt.
            <div key={k} className={`grid items-center gap-x-4 p-4 sm:grid-cols-[auto_1fr] ${card}`}>
              <dt className="contents text-sm text-muted">
                <span
                  className="row-span-2 hidden size-11 place-items-center rounded-full bg-canvas text-muted sm:grid"
                  aria-hidden="true"
                >
                  <Icon name={STAT_ICON[k]} size={20} />
                </span>
                <span className="text-sm text-muted">{t(`stats.${k}`)}</span>
              </dt>
              <dd className="font-display text-2xl font-bold tabular-nums">
                <CountUp value={stats[k]} />
              </dd>
            </div>
          ))}
        </dl>
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
      <ul className="stagger grid gap-3 sm:grid-cols-2">
        {courses.slice(0, 4).map((c) => (
          <li key={c.id}>
            <Link
              href={`/courses/${c.id}`}
              className="lift flex items-center gap-3 rounded-xl border border-line p-3 hover:border-line-strong"
            >
              <span
                className="grid size-10 shrink-0 place-items-center rounded-lg font-display text-lg font-bold text-white"
                style={{ background: c.color }}
                aria-hidden="true"
              >
                {c.title.trim().charAt(0).toUpperCase()}
              </span>
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
