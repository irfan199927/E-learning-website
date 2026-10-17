import { formatInZone, isAppError, type GradeCell, type GradeItem, type GradeTotal } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getGradebook, getMyGrades } from "@/server/services/gradebook";
import { ExcuseButton, WeightingForm } from "./grade-controls";

export const metadata: Metadata = { title: "Grades" };

const card = "rounded-[var(--radius-card)] border border-line bg-surface p-5";
const badge = "inline-block rounded-full px-2 py-0.5 text-xs font-semibold";

const itemHref = (i: GradeItem) => (i.kind === "quiz" ? `/quizzes/${i.id}` : `/assignments/${i.id}`);

function totalText(t: GradeTotal) {
  return t.percent === null ? "—" : `${t.percent}%`;
}

function Cell({
  cell,
  item,
  excuse,
}: {
  cell: GradeCell;
  item: GradeItem;
  excuse: { courseId: string; userId: string; studentName: string };
}) {
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
          {cell.late && <span className="ml-1 text-xs text-muted">late</span>}
        </>
      );
    case "to-grade":
      return (
        <Link href={itemHref(item)} className={`${badge} bg-primary-soft text-primary-fg-strong`}>
          To grade{cell.late ? " · late" : ""}
        </Link>
      );
    case "missing":
      return (
        <span className="flex flex-wrap items-center gap-1">
          <span className={`${badge} bg-warning-soft text-warning`}>Missing</span>
          {excuseButton(false)}
        </span>
      );
    case "excused":
      return (
        <span className="flex flex-wrap items-center gap-1">
          <span className={`${badge} bg-canvas text-muted`}>Excused</span>
          {excuseButton(true)}
        </span>
      );
    case "open":
      return (
        <span className="text-muted" aria-label="Not due yet">
          —
        </span>
      );
  }
}

const RULES =
  "Totals count graded work, and overdue work that was never handed in as 0. Work waiting to be graded, work not due yet and excused work are left out.";

const weightingText = (w: number | null) =>
  w === null ? "Weighted by points." : `Weighted: assignments ${w}%, quizzes ${100 - w}%.`;

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

function Gradebook({ book, tz }: { book: Awaited<ReturnType<typeof getGradebook>>; tz: string }) {
  const due = (d: Date | null) => (d ? `Due ${formatInZone(d, tz)}` : "No closing date");
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <BackLink course={book.course} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{book.course.title}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Gradebook</h1>
          <p className="mt-1 text-muted">
            {plural(book.students.length, "student")} · {plural(book.items.length, "piece")} of published work
          </p>
        </div>
        {book.students.length > 0 && (
          <a
            href={`/api/v1/courses/${book.course.id}/gradebook/csv`}
            download
            className={buttonClasses("secondary")}
          >
            <Icon name="download" size={18} />
            Download CSV
          </a>
        )}
      </header>

      <section aria-labelledby="book-h" className={card}>
        <h2 id="book-h" className="sr-only">
          Marks
        </h2>
        {book.students.length === 0 || book.items.length === 0 ? (
          <p className="text-muted">
            {book.students.length === 0
              ? "No students in this course yet."
              : "Nothing to grade yet. Published assignments and quizzes appear here."}
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              {RULES} {weightingText(book.assignmentWeight)}
            </p>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Gradebook table">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Marks for each student. Columns are assignments and quizzes, then the total.
                </caption>
                <thead>
                  <tr className="border-b border-line align-bottom text-muted">
                    <th scope="col" className="sticky left-0 z-10 bg-surface py-2 pr-4 font-semibold">
                      Student
                    </th>
                    {book.items.map((i) => (
                      <th key={i.id} scope="col" className="min-w-36 px-3 py-2 font-normal">
                        <Link href={itemHref(i)} className="font-semibold text-ink hover:text-primary-fg">
                          {i.title}
                        </Link>
                        <span className="block text-xs">
                          {i.kind === "quiz" ? "Quiz" : "Assignment"} · out of {i.maxPoints}
                        </span>
                        <span className="block text-xs">{due(i.dueAt)}</span>
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Total
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
                      Class average
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
          Weighting
        </h2>
        <WeightingForm courseId={book.course.id} assignmentWeight={book.assignmentWeight} />
      </section>
    </div>
  );
}

function StudentGrades({ view, tz }: { view: Awaited<ReturnType<typeof getMyGrades>>; tz: string }) {
  const status = (c: GradeCell, i: GradeItem) => {
    switch (c.status) {
      case "graded":
        return `${c.score}/${i.maxPoints}${c.late ? " · handed in late" : ""}`;
      case "to-grade":
        return "Handed in, waiting to be graded";
      case "missing":
        return "Missing: counts as 0";
      case "excused":
        return "Excused: not counted";
      case "open":
        return i.dueAt ? `Due ${formatInZone(i.dueAt, tz)}` : "Not taken yet";
    }
  };
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink course={view.course} />
      <header>
        <p className="text-sm font-semibold text-muted">{view.course.title}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">My grades</h1>
      </header>

      <section aria-labelledby="total-h" className={card}>
        <h2 id="total-h" className="text-sm font-semibold text-muted">
          Total so far
        </h2>
        <p className="font-display text-4xl font-bold">{totalText(view.total)}</p>
        <p className="text-muted">
          {view.total.possible > 0
            ? `${view.total.earned} of ${view.total.possible} points`
            : "Nothing has been graded yet."}
        </p>
        <p className="mt-3 text-sm text-muted">
          {RULES} {weightingText(view.assignmentWeight)}
        </p>
      </section>

      <section aria-labelledby="work-h" className={card}>
        <h2 id="work-h" className="mb-2 font-display text-xl font-bold">
          Work
        </h2>
        {view.items.length === 0 ? (
          <p className="text-muted">No assignments or quizzes yet.</p>
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
                        {i.kind === "quiz" ? "Quiz" : "Assignment"} · {status(c, i)}
                      </span>
                    </span>
                    {c.status === "missing" && (
                      <span className={`${badge} bg-warning-soft text-warning`}>Missing</span>
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
