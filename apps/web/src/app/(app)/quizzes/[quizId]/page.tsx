import { formatInZone, isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getQuizForStudent, quizResults } from "@/server/services/quizzes";
import { QuizRunner } from "./quiz-runner";
import { StartQuizButton } from "./start-button";

export const metadata: Metadata = { title: "Quiz" };

const card = "rounded-[var(--radius-card)] border border-line bg-surface p-5";

export default async function QuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const actor = await requirePageActor(["STUDENT", "TEACHER", "ADMIN"]);
  const { quizId } = await params;
  const view = await getQuizForStudent(deps(), actor, quizId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  const q = view.quiz;
  const results = view.canManage ? await quizResults(deps(), actor, quizId) : null;
  const facts = [
    `${q.questionCount} ${q.questionCount === 1 ? "question" : "questions"}`,
    `${q.maxPoints} ${q.maxPoints === 1 ? "point" : "points"}`,
    q.timeLimitSec ? `${Math.round(q.timeLimitSec / 60)} min` : "No time limit",
    `${q.maxAttempts} ${q.maxAttempts === 1 ? "attempt" : "attempts"}`,
    q.dueAt ? `closes ${formatInZone(q.dueAt, actor.timezone)}` : null,
  ].filter(Boolean);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href={`/courses/${q.courseId}#quizzes`}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        {q.courseTitle}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">Quiz</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{q.title}</h1>
          <p className="mt-1 text-muted">{facts.join(" · ")}</p>
        </div>
        {view.canManage && (
          <Link href={`/quizzes/${q.id}/edit`} className={buttonClasses("secondary")}>
            <Icon name="edit" size={18} />
            Edit
          </Link>
        )}
      </header>

      {results && (
        <section aria-labelledby="results-h" className={card}>
          <h2 id="results-h" className="mb-3 font-display text-xl font-bold">
            Results
          </h2>
          {results.rows.length === 0 ? (
            <p className="text-muted">No students in this course yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      Student
                    </th>
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      Best score
                    </th>
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      Attempts
                    </th>
                    <th scope="col" className="py-2 font-semibold">
                      Last
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {results.rows.map((r) => (
                    <tr key={r.userId}>
                      <td className="py-2.5 pr-3 font-semibold">{r.name}</td>
                      <td className="py-2.5 pr-3">
                        {r.best === null ? (
                          <span className="text-muted">Not taken</span>
                        ) : (
                          `${r.best}/${results.maxPoints}`
                        )}
                      </td>
                      <td className="py-2.5 pr-3">{r.attempts}</td>
                      <td className="py-2.5">{r.lastAt ? formatInZone(r.lastAt, actor.timezone) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!view.canManage && view.open && (
        <QuizRunner
          attemptId={view.open.id}
          questions={view.open.questions}
          deadline={view.open.deadline?.toISOString() ?? null}
        />
      )}

      {!view.canManage && !view.open && (
        <>
          {view.last && (
            <section aria-labelledby="last-h" className={card}>
              <h2 id="last-h" className="font-display text-xl font-bold">
                Your score: {view.last.score}/{view.last.max}
              </h2>
              <p className="mb-3 text-sm text-muted">
                {view.attemptsUsed} of {q.maxAttempts} {q.maxAttempts === 1 ? "attempt" : "attempts"} used
                {view.best !== null && view.attemptsUsed > 1 && ` · best ${view.best}/${q.maxPoints}`}
                {view.last.questions.some((x) => x.correctOptions === null) &&
                  " · the right answers show once you have no attempts left"}
              </p>
              <ol className="flex flex-col gap-3">
                {view.last.questions.map((x, i) => (
                  <li key={x.id} className="rounded-[var(--radius-control)] border border-line p-3">
                    <p className="font-semibold">
                      {i + 1}. {x.prompt}{" "}
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          x.right ? "bg-success-soft text-[#0C6447]" : "bg-live-soft text-[#A11C14]"
                        }`}
                      >
                        {x.right ? "Right" : "Wrong"}
                      </span>
                    </p>
                    <ul className="mt-2 flex flex-col gap-1 text-sm">
                      {x.options.map((o, k) => {
                        const chosen = x.chosen.includes(k);
                        const correct = x.correctOptions?.includes(k);
                        return (
                          <li key={k} className={chosen ? "font-semibold" : ""}>
                            {chosen ? "● " : "○ "}
                            {o}
                            {chosen && <span className="sr-only"> (your answer)</span>}
                            {correct && (
                              <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-[#0C6447]">
                                Correct answer
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {view.blocked === null ? (
            <section className={card}>
              <p className="mb-3">
                {q.timeLimitSec
                  ? `You'll have ${Math.round(q.timeLimitSec / 60)} minutes once you start. Your answers are sent automatically when the time is up.`
                  : "There's no time limit."}
              </p>
              <StartQuizButton quizId={q.id} label={view.attemptsUsed ? "Try again" : "Start quiz"} />
            </section>
          ) : (
            <p className="text-muted">
              {view.blocked === "no-attempts-left"
                ? "You've used all your attempts."
                : "This quiz is closed: its closing date has passed."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
