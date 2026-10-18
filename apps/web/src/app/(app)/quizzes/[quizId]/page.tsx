import { formatInZone, isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getQuizForStudent, quizResults } from "@/server/services/quizzes";
import { QuizRunner } from "./quiz-runner";
import { StartQuizButton } from "./start-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Quizzes"))("title") };
}

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
  const [t, locale] = await Promise.all([getTranslations("Quizzes"), getLocale()]);
  const when = (d: Date) => formatInZone(d, actor.timezone, intlLocale(locale));
  const facts = [
    t("questions", { count: q.questionCount }),
    t("points", { count: q.maxPoints }),
    q.timeLimitSec ? t("timeLimit", { minutes: Math.round(q.timeLimitSec / 60) }) : t("noTimeLimit"),
    t("attempts", { count: q.maxAttempts }),
    q.dueAt ? t("closes", { when: when(q.dueAt) }) : null,
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
          <p className="text-sm font-semibold text-muted">{t("title")}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{q.title}</h1>
          <p className="mt-1 text-muted">{facts.join(" · ")}</p>
        </div>
        {view.canManage && (
          <Link href={`/quizzes/${q.id}/edit`} className={buttonClasses("secondary")}>
            <Icon name="edit" size={18} />
            {t("edit")}
          </Link>
        )}
      </header>

      {results && (
        <section aria-labelledby="results-h" className={card}>
          <h2 id="results-h" className="mb-3 font-display text-xl font-bold">
            {t("results")}
          </h2>
          {results.rows.length === 0 ? (
            <p className="text-muted">{t("noStudents")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      {t("student")}
                    </th>
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      {t("bestScore")}
                    </th>
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      {t("attemptsColumn")}
                    </th>
                    <th scope="col" className="py-2 font-semibold">
                      {t("last")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {results.rows.map((r) => (
                    <tr key={r.userId}>
                      <td className="py-2.5 pr-3 font-semibold">{r.name}</td>
                      <td className="py-2.5 pr-3">
                        {r.best === null ? (
                          <span className="text-muted">{t("notTaken")}</span>
                        ) : (
                          `${r.best}/${results.maxPoints}`
                        )}
                      </td>
                      <td className="py-2.5 pr-3">{r.attempts}</td>
                      <td className="py-2.5">{r.lastAt ? when(r.lastAt) : "—"}</td>
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
                {t("yourScore", { score: view.last.score, max: view.last.max })}
              </h2>
              <p className="mb-3 text-sm text-muted">
                {[
                  t("attemptsUsed", { used: view.attemptsUsed, count: q.maxAttempts }),
                  view.best !== null &&
                    view.attemptsUsed > 1 &&
                    t("best", { score: view.best, max: q.maxPoints }),
                  view.last.questions.some((x) => x.correctOptions === null) && t("answersLater"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <ol className="flex flex-col gap-3">
                {view.last.questions.map((x, i) => (
                  <li key={x.id} className="rounded-[var(--radius-control)] border border-line p-3">
                    <p className="font-semibold">
                      {i + 1}. {x.prompt}{" "}
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          x.right ? "bg-success-soft text-[#0C6447]" : "bg-live-soft text-live-fg"
                        }`}
                      >
                        {x.right ? t("right") : t("wrong")}
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
                            {chosen && <span className="sr-only"> {t("yourAnswer")}</span>}
                            {correct && (
                              <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-[#0C6447]">
                                {t("correctAnswer")}
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
                  ? t("timeNote", { minutes: Math.round(q.timeLimitSec / 60) })
                  : t("noTimeLimitNote")}
              </p>
              <StartQuizButton quizId={q.id} label={view.attemptsUsed ? t("tryAgain") : t("start")} />
            </section>
          ) : (
            <p className="text-muted">
              {view.blocked === "no-attempts-left" ? t("noAttemptsLeft") : t("closed")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
