import { isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon } from "@/components/icons";
import { MonthlyProgress, TodayProgress } from "@/components/learner-progress";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { ATTENDANCE_DAYS, getChildProgress } from "@/server/services/parents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Children"))("progressTitle") };
}

const card = "rounded-[var(--radius-card)] border border-line bg-surface";
const pill = "rounded-full px-2 py-0.5 text-xs font-semibold";

/** Message key for each course state. */
const STATE = {
  "not-started": "notStarted",
  "in-progress": "inProgress",
  completed: "completed",
} as const;

export default async function ChildProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const actor = await requirePageActor(["PARENT"]);
  const { childId } = await params;
  const { month } = await searchParams;
  const p = await getChildProgress(deps(), actor, childId, {
    month: typeof month === "string" ? month : undefined,
  }).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  const [t, locale] = await Promise.all([getTranslations("Children"), getLocale()]);
  const first = p.child.name.split(" ")[0] ?? "";
  const day = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: actor.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const date = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: actor.timezone,
    day: "numeric",
    month: "short",
  });

  return (
    <div className="flex max-w-6xl flex-col gap-7">
      <Link href="/children" className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg">
        <Icon name="chevronLeft" size={16} />
        {t("title")}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{p.child.name}</h1>
          <p className="mt-1 text-muted">{t("sameProgress", { name: first })}</p>
        </div>
        <p className="flex items-center gap-2" aria-label={t("streakLabel", { count: p.overview.streak })}>
          <Icon name="flame" size={28} />
          <span className="flex flex-col leading-tight">
            <b className="text-lg">{p.overview.streak}</b>
            <span className="text-xs text-muted">{t("streakUnit", { count: p.overview.streak })}</span>
          </span>
        </p>
      </header>

      <div className="grid gap-7 md:grid-cols-2">
        <TodayProgress
          seconds={p.overview.todaySeconds}
          goalMinutes={p.overview.goalMinutes}
          questions={p.overview.questionsToday}
          lessonsCompleted={p.overview.lessonsCompleted}
          coursesInProgress={p.overview.coursesInProgress}
        />
        <MonthlyProgress month={p.overview.month} basePath={`/children/${p.child.id}`} />
      </div>

      <section aria-labelledby="courses-h">
        <h2 id="courses-h" className="mb-3 font-display text-xl font-bold">
          {t("coursesCount", { count: p.courses.length })}
        </h2>
        {p.courses.length === 0 ? (
          <p className={`p-5 text-muted ${card}`}>{t("noCourses", { name: first })}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {p.courses.map((c) => (
              <li key={c.id} className={`flex gap-4 p-4 ${card}`}>
                <span
                  className="w-1.5 shrink-0 rounded-full"
                  style={{ background: c.color }}
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h3 className="truncate font-bold">{c.title}</h3>
                  <p className="text-sm text-muted">
                    {t("withTeacher", { teacher: c.teacherName, state: t(STATE[c.state]) })}
                    {c.lastActivityAt && t("lastActive", { date: date.format(c.lastActivityAt) })}
                  </p>
                  <div className="mt-auto flex justify-between text-sm">
                    <span>{t("lessons", { done: c.completedCount, total: c.lessonCount })}</span>
                    <span className="text-muted">{c.percent}%</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-line"
                    role="progressbar"
                    aria-label={t("courseProgress", { course: c.title })}
                    aria-valuenow={c.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full rounded-full bg-success" style={{ width: `${c.percent}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="grades-h" className={`p-5 ${card}`}>
        <h2 id="grades-h" className="mb-3 font-display text-xl font-bold">
          {t("grades")}
        </h2>
        {p.grades.length === 0 ? (
          <p className="text-muted">{t("noGrades")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    {t("work")}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    {t("course")}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    {t("score")}
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    {t("when")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {p.grades.map((g) => (
                  <tr key={`${g.kind}-${g.id}`}>
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold">{g.title}</span>
                      <span className="block text-muted">
                        {g.kind === "quiz" ? t("quiz") : t("assignment")}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">{g.courseTitle}</td>
                    <td className="py-2.5 pr-3 font-semibold">
                      {g.score}/{g.max}
                    </td>
                    <td className="py-2.5">{date.format(g.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="attendance-h" className={`p-5 ${card}`}>
        <h2 id="attendance-h" className="font-display text-xl font-bold">
          {t("liveClasses", { days: ATTENDANCE_DAYS })}
        </h2>
        <p className="mb-3 text-sm text-muted">
          {p.attendance.recorded > 0
            ? t("attendedOf", { attended: p.attendance.attended, recorded: p.attendance.recorded })
            : t("fromMeet")}
        </p>
        {p.attendance.rows.length === 0 ? (
          <p className="text-muted">{t("noClasses")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    {t("class")}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    {t("course")}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    {t("when")}
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    {t("attendance")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {p.attendance.rows.map((r) => (
                  <tr key={r.classId}>
                    <td className="py-2.5 pr-3 font-semibold">{r.title}</td>
                    <td className="py-2.5 pr-3">{r.courseTitle}</td>
                    <td className="py-2.5 pr-3">{day.format(r.startsAt)}</td>
                    <td className="py-2.5">
                      {r.present === null ? (
                        <span className="text-muted">{t("notRecorded")}</span>
                      ) : r.present ? (
                        <span className={`${pill} bg-success-soft text-[#0C6447]`}>
                          {t("attended")}
                          {r.minutes > 0 && t("attendedMinutes", { minutes: r.minutes })}
                        </span>
                      ) : (
                        <span className={`${pill} bg-live-soft text-live-fg`}>{t("missed")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
