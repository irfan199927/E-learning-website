import { formatInZone, isAppError, type GradeCell, type GradeItem, type GradeTotal } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getGradebook, getMyGrades } from "@/server/services/gradebook";
import { ExcuseButton, WeightingForm } from "./grade-controls";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Grades"))("title") };
}

const card = "rounded-[var(--radius-card)] border border-line bg-surface p-5";
const badge = "inline-block rounded-full px-2 py-0.5 text-xs font-semibold";

const itemHref = (i: GradeItem) => (i.kind === "quiz" ? `/quizzes/${i.id}` : `/assignments/${i.id}`);

function totalText(t: GradeTotal) {
  return t.percent === null ? "—" : `${t.percent}%`;
}

async function Cell({
  cell,
  item,
  excuse,
}: {
  cell: GradeCell;
  item: GradeItem;
  excuse: { courseId: string; userId: string; studentName: string };
}) {
  const t = await getTranslations("Grades");
  const excuseButton = (excused: boolean) => (
    <ExcuseButton
      courseId={excuse.courseId}
      itemKind={item.kind}
      itemId={item.id}
      itemTitle={item.title}
      userId={excuse.userId}
      studentName={excuse.studentName}
      excused={excused}
    />
  );
  switch (cell.status) {
    case "graded":
      return (
        <>
          {cell.score}
          {cell.late && <span className="ml-1 text-xs text-muted">{t("late")}</span>}
        </>
      );
    case "to-grade":
      return (
        <Link href={itemHref(item)} className={`${badge} bg-primary-soft text-primary-fg-strong`}>
          {t(cell.late ? "toGradeLate" : "toGrade")}
        </Link>
      );
    case "missing":
      return (
        <span className="flex flex-wrap items-center gap-1">
          <span className={`${badge} bg-warning-soft text-warning`}>{t("missing")}</span>
          {excuseButton(false)}
        </span>
      );
    case "excused":
      return (
        <span className="flex flex-wrap items-center gap-1">
          <span className={`${badge} bg-canvas text-muted`}>{t("excused")}</span>
          {excuseButton(true)}
        </span>
      );
    case "open":
      return (
        <span className="text-muted" aria-label={t("notDue")}>
          —
        </span>
      );
  }
}

type GradesT = Awaited<ReturnType<typeof getTranslations<"Grades">>>;

const weightingText = (t: GradesT, w: number | null) =>
  w === null ? t("weightedByPoints") : t("weighted", { assignments: w, quizzes: 100 - w });

export default async function GradesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const actor = await requirePageActor(["ADMIN", "TEACHER", "STUDENT"]);
  const { courseId } = await params;
  const onError = (err: unknown): never => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  };
  return actor.role === "STUDENT" ? (
    <StudentGrades view={await getMyGrades(deps(), actor, courseId).catch(onError)} tz={actor.timezone} />
  ) : (
    <Gradebook book={await getGradebook(deps(), actor, courseId).catch(onError)} tz={actor.timezone} />
  );
}

function BackLink({ course }: { course: { id: string; title: string } }) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
    >
      <Icon name="chevronLeft" size={16} />
      {course.title}
    </Link>
  );
}

async function Gradebook({ book, tz }: { book: Awaited<ReturnType<typeof getGradebook>>; tz: string }) {
  const [t, locale] = await Promise.all([getTranslations("Grades"), getLocale()]);
  const due = (d: Date | null) =>
    d ? t("due", { when: formatInZone(d, tz, intlLocale(locale)) }) : t("noClosingDate");
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <BackLink course={book.course} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{book.course.title}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("gradebook")}</h1>
          <p className="mt-1 text-muted">
            {t("summary", { students: book.students.length, items: book.items.length })}
          </p>
        </div>
        {book.students.length > 0 && (
          <a
            href={`/api/v1/courses/${book.course.id}/gradebook/csv`}
            download
            className={buttonClasses("secondary")}
          >
            <Icon name="download" size={18} />
            {t("downloadCsv")}
          </a>
        )}
      </header>

      <section aria-labelledby="book-h" className={card}>
        <h2 id="book-h" className="sr-only">
          {t("marks")}
        </h2>
        {book.students.length === 0 || book.items.length === 0 ? (
          <p className="text-muted">{book.students.length === 0 ? t("noStudents") : t("nothingToGrade")}</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              {t("rules")} {weightingText(t, book.assignmentWeight)}
            </p>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t("tableLabel")}>
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t("caption")}</caption>
                <thead>
                  <tr className="border-b border-line align-bottom text-muted">
                    <th scope="col" className="sticky left-0 z-10 bg-surface py-2 pr-4 font-semibold">
                      {t("student")}
                    </th>
                    {book.items.map((i) => (
                      <th key={i.id} scope="col" className="min-w-36 px-3 py-2 font-normal">
                        <Link href={itemHref(i)} className="font-semibold text-ink hover:text-primary-fg">
                          {i.title}
                        </Link>
                        <span className="block text-xs">
                          {t("kind", { kind: i.kind })} · {t("outOf", { max: i.maxPoints })}
                        </span>
                        <span className="block text-xs">{due(i.dueAt)}</span>
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2 font-semibold">
                      {t("total")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {book.students.map((s) => (
                    <tr key={s.userId}>
                      <th scope="row" className="sticky left-0 z-10 bg-surface py-2.5 pr-4 font-semibold">
                        {s.name}
                      </th>
                      {s.cells.map((c, i) => (
                        <td key={book.items[i]!.id} className="px-3 py-2.5">
                          <Cell
                            cell={c}
                            item={book.items[i]!}
                            excuse={{ courseId: book.course.id, userId: s.userId, studentName: s.name }}
                          />
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="font-semibold">{totalText(s.total)}</span>
                        {s.total.possible > 0 && (
                          <span className="block text-xs text-muted">
                            {s.total.earned}/{s.total.possible}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line-strong text-muted">
                    <th scope="row" className="sticky left-0 z-10 bg-surface py-2.5 pr-4 font-semibold">
                      {t("classAverage")}
                    </th>
                    {book.averages.map((a, i) => (
                      <td key={book.items[i]!.id} className="px-3 py-2.5">
                        {a === null ? "—" : a}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="weighting-h" className={card}>
        <h2 id="weighting-h" className="mb-3 font-display text-xl font-bold">
          {t("weighting")}
        </h2>
        <WeightingForm courseId={book.course.id} assignmentWeight={book.assignmentWeight} />
      </section>
    </div>
  );
}

async function StudentGrades({ view, tz }: { view: Awaited<ReturnType<typeof getMyGrades>>; tz: string }) {
  const [t, locale] = await Promise.all([getTranslations("Grades"), getLocale()]);
  const status = (c: GradeCell, i: GradeItem) => {
    switch (c.status) {
      case "graded":
        return t(c.late ? "gradedLate" : "graded", { score: c.score ?? 0, max: i.maxPoints });
      case "to-grade":
        return t("waiting");
      case "missing":
        return t("missingZero");
      case "excused":
        return t("excusedNotCounted");
      case "open":
        return i.dueAt ? t("due", { when: formatInZone(i.dueAt, tz, intlLocale(locale)) }) : t("notTakenYet");
    }
  };
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink course={view.course} />
      <header>
        <p className="text-sm font-semibold text-muted">{view.course.title}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("myGrades")}</h1>
      </header>

      <section aria-labelledby="total-h" className={card}>
        <h2 id="total-h" className="text-sm font-semibold text-muted">
          {t("totalSoFar")}
        </h2>
        <p className="font-display text-4xl font-bold">{totalText(view.total)}</p>
        <p className="text-muted">
          {view.total.possible > 0
            ? t("pointsOf", { earned: view.total.earned, possible: view.total.possible })
            : t("nothingGraded")}
        </p>
        <p className="mt-3 text-sm text-muted">
          {t("rules")} {weightingText(t, view.assignmentWeight)}
        </p>
      </section>

      <section aria-labelledby="work-h" className={card}>
        <h2 id="work-h" className="mb-2 font-display text-xl font-bold">
          {t("work")}
        </h2>
        {view.items.length === 0 ? (
          <p className="text-muted">{t("noWork")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {view.items.map((i, n) => {
              const c = view.cells[n]!;
              return (
                <li key={i.id}>
                  <Link
                    href={itemHref(i)}
                    className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-canvas"
                  >
                    <Icon
                      name={i.kind === "quiz" ? "check" : "file"}
                      size={20}
                      className="shrink-0 text-primary-fg"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{i.title}</span>
                      <span className="text-sm text-muted">
                        {t("kind", { kind: i.kind })} · {status(c, i)}
                      </span>
                    </span>
                    {c.status === "missing" && (
                      <span className={`${badge} bg-warning-soft text-warning`}>{t("missing")}</span>
                    )}
                    <Icon name="chevronRight" size={18} className="shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
