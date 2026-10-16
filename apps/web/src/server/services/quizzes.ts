/**
 * MCQ quizzes: a teacher writes questions (2–6 options, one or more correct); students take timed attempts that
 * are scored on submit (core `scoreQuiz`: a question counts only when exactly the right options are chosen).
 *
 * - Students only see published quizzes of courses they're enrolled in, and never the correct answers before
 *   submitting. After an attempt they see which questions they got right; the right options are revealed once
 *   they have no attempts left (or the quiz is past its due date).
 * - Attempts: at most `maxAttempts`, none after `dueAt`. A timed attempt must be submitted within the limit plus
 *   QUIZ_GRACE_SECONDS; later answers are ignored (scored as blank). An expired open attempt is closed the next time
 *   the student opens the quiz.
 * - Questions can't change once anyone has submitted an attempt (scores would no longer mean the same thing).
 */
import {
  assertCan,
  attemptDeadline,
  Errors,
  QUIZ_GRACE_SECONDS,
  scoreQuiz,
  seededShuffle,
  type SaveQuizInput,
  type SubmitQuizInput,
} from "@elearner/core";
import type { Prisma } from "@elearner/db";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess, hasCourseAccess } from "../policies";

type Answers = Record<string, number[]>;

const quizSelect = {
  id: true,
  courseId: true,
  title: true,
  timeLimitSec: true,
  dueAt: true,
  maxAttempts: true,
  shuffle: true,
  publishedAt: true,
  course: { select: { title: true } },
  questions: {
    orderBy: { position: "asc" },
    select: { id: true, prompt: true, options: true, correct: true, points: true, position: true },
  },
} satisfies Prisma.QuizSelect;

type QuizRow = Prisma.QuizGetPayload<{ select: typeof quizSelect }>;

async function load(deps: Deps, actor: Actor, quizId: string) {
  const quiz = await deps.db.quiz.findUnique({ where: { id: quizId }, select: quizSelect });
  if (!quiz) throw Errors.notFound("Quiz");
  if (await hasCourseAccess(deps.db, actor, quiz.courseId, "manage")) return { quiz, manage: true };
  const student =
    actor.role === "STUDENT" &&
    quiz.publishedAt !== null &&
    (await hasCourseAccess(deps.db, actor, quiz.courseId, "watch"));
  if (!student) throw Errors.notFound("Quiz");
  return { quiz, manage: false };
}

const maxPointsOf = (q: QuizRow) => q.questions.reduce((n, x) => n + x.points, 0);

export interface QuizSummary {
  id: string;
  title: string;
  questionCount: number;
  maxPoints: number;
  timeLimitSec: number | null;
  dueAt: Date | null;
  maxAttempts: number;
  published: boolean;
  /** Staff: students who submitted at least once. */
  takenBy: number | null;
  /** Students: attempts used and best score. */
  mine: { attempts: number; best: number | null } | null;
}

export async function listCourseQuizzes(deps: Deps, actor: Actor, courseId: string): Promise<QuizSummary[]> {
  await assertCourseAccess(deps.db, actor, courseId, "watch");
  const manage = await hasCourseAccess(deps.db, actor, courseId, "manage");
  const rows = await deps.db.quiz.findMany({
    where: { courseId, ...(manage ? {} : { publishedAt: { not: null } }) },
    select: {
      id: true,
      title: true,
      timeLimitSec: true,
      dueAt: true,
      maxAttempts: true,
      publishedAt: true,
      questions: { select: { points: true } },
      attempts: {
        where: { submittedAt: { not: null }, ...(manage ? {} : { userId: actor.id }) },
        select: { userId: true, score: true },
      },
    },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { title: "asc" }],
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    questionCount: r.questions.length,
    maxPoints: r.questions.reduce((n, q) => n + q.points, 0),
    timeLimitSec: r.timeLimitSec,
    dueAt: r.dueAt,
    maxAttempts: r.maxAttempts,
    published: r.publishedAt !== null,
    takenBy: manage ? new Set(r.attempts.map((a) => a.userId)).size : null,
    mine: manage
      ? null
      : {
          attempts: r.attempts.length,
          best: r.attempts.length ? Math.max(...r.attempts.map((a) => a.score ?? 0)) : null,
        },
  }));
}

function questionRows(quizId: string, input: SaveQuizInput) {
  return input.questions.map((q, i) => ({
    quizId,
    prompt: q.prompt,
    options: q.options,
    correct: [...new Set(q.correct)].sort((a, b) => a - b),
    points: q.points,
    position: i + 1,
  }));
}

export async function createQuiz(
  deps: Deps,
  actor: Actor,
  courseId: string,
  input: SaveQuizInput,
): Promise<{ id: string }> {
  assertCan(actor.role, "course:manage");
  await assertCourseAccess(deps.db, actor, courseId, "manage");
  const quiz = await deps.db.$transaction(async (tx) => {
    const q = await tx.quiz.create({
      data: {
        courseId,
        title: input.title,
        timeLimitSec: input.timeLimitMinutes ? input.timeLimitMinutes * 60 : null,
        dueAt: input.dueAt ?? null,
        maxAttempts: input.maxAttempts,
        shuffle: input.shuffle,
        publishedAt: input.published ? deps.now() : null,
      },
      select: { id: true },
    });
    await tx.quizQuestion.createMany({ data: questionRows(q.id, input) });
    return q;
  });
  await audit(deps.db, actor, "quiz.create", { type: "Quiz", id: quiz.id });
  return quiz;
}

const sameQuestions = (quiz: QuizRow, input: SaveQuizInput) =>
  JSON.stringify(
    quiz.questions.map(({ prompt, options, correct, points }) => ({ prompt, options, correct, points })),
  ) ===
  JSON.stringify(
    questionRows(quiz.id, input).map(({ prompt, options, correct, points }) => ({
      prompt,
      options,
      correct,
      points,
    })),
  );

export async function updateQuiz(
  deps: Deps,
  actor: Actor,
  quizId: string,
  input: SaveQuizInput,
): Promise<{ id: string }> {
  assertCan(actor.role, "course:manage");
  const { quiz, manage } = await load(deps, actor, quizId);
  if (!manage) throw Errors.notFound("Quiz");
  const changed = !sameQuestions(quiz, input);
  if (changed && (await deps.db.quizAttempt.count({ where: { quizId, submittedAt: { not: null } } })))
    throw Errors.conflict(
      "Students have already taken this quiz, so its questions can't change. Make a new quiz instead.",
    );
  await deps.db.$transaction(async (tx) => {
    await tx.quiz.update({
      where: { id: quizId },
      data: {
        title: input.title,
        timeLimitSec: input.timeLimitMinutes ? input.timeLimitMinutes * 60 : null,
        dueAt: input.dueAt ?? null,
        maxAttempts: input.maxAttempts,
        shuffle: input.shuffle,
        publishedAt: input.published ? (quiz.publishedAt ?? deps.now()) : null,
      },
    });
    if (changed) {
      await tx.quizAttempt.deleteMany({ where: { quizId } }); // only unsubmitted ones can exist here
      await tx.quizQuestion.deleteMany({ where: { quizId } });
      await tx.quizQuestion.createMany({ data: questionRows(quizId, input) });
    }
  });
  await audit(deps.db, actor, "quiz.update", { type: "Quiz", id: quizId }, { questionsChanged: changed });
  return { id: quizId };
}

export async function deleteQuiz(deps: Deps, actor: Actor, quizId: string): Promise<void> {
  assertCan(actor.role, "course:manage");
  const { quiz, manage } = await load(deps, actor, quizId);
  if (!manage) throw Errors.notFound("Quiz");
  await deps.db.quiz.delete({ where: { id: quizId } });
  await audit(deps.db, actor, "quiz.delete", { type: "Quiz", id: quizId }, { title: quiz.title });
}

export interface QuizForEditing {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  timeLimitMinutes: number | null;
  dueAt: Date | null;
  maxAttempts: number;
  shuffle: boolean;
  published: boolean;
  questions: { prompt: string; options: string[]; correct: number[]; points: number }[];
  /** Questions are locked once someone submitted. */
  locked: boolean;
}

export async function getQuizForEditing(deps: Deps, actor: Actor, quizId: string): Promise<QuizForEditing> {
  assertCan(actor.role, "course:manage");
  const { quiz, manage } = await load(deps, actor, quizId);
  if (!manage) throw Errors.notFound("Quiz");
  const taken = await deps.db.quizAttempt.count({ where: { quizId, submittedAt: { not: null } } });
  return {
    id: quiz.id,
    courseId: quiz.courseId,
    courseTitle: quiz.course.title,
    title: quiz.title,
    timeLimitMinutes: quiz.timeLimitSec ? Math.round(quiz.timeLimitSec / 60) : null,
    dueAt: quiz.dueAt,
    maxAttempts: quiz.maxAttempts,
    shuffle: quiz.shuffle,
    published: quiz.publishedAt !== null,
    questions: quiz.questions.map(({ prompt, options, correct, points }) => ({
      prompt,
      options,
      correct,
      points,
    })),
    locked: taken > 0,
  };
}

// ── Taking a quiz ──

export interface AttemptQuestion {
  id: string;
  prompt: string;
  options: string[];
  points: number;
  /** More than one option is correct (so the UI shows checkboxes). */
  multiple: boolean;
}

export interface AttemptResult {
  id: string;
  score: number;
  max: number;
  submittedAt: Date;
  /** Per question in the order the student saw them. `correctOptions` only once answers are revealed. */
  questions: (AttemptQuestion & { chosen: number[]; right: boolean; correctOptions: number[] | null })[];
}

export interface QuizStudentView {
  quiz: {
    id: string;
    courseId: string;
    courseTitle: string;
    title: string;
    questionCount: number;
    maxPoints: number;
    timeLimitSec: number | null;
    dueAt: Date | null;
    maxAttempts: number;
  };
  canManage: boolean;
  attemptsUsed: number;
  /** Why a new attempt can't start (null = it can). */
  blocked: null | "no-attempts-left" | "past-due";
  /** An attempt in progress. */
  open: { id: string; deadline: Date | null; questions: AttemptQuestion[] } | null;
  /** The latest submitted attempt. */
  last: AttemptResult | null;
  best: number | null;
}

function attemptQuestions(quiz: QuizRow, attemptId: string): QuizRow["questions"] {
  return quiz.shuffle ? seededShuffle(quiz.questions, attemptId) : quiz.questions;
}

const toQuestion = (q: QuizRow["questions"][number]): AttemptQuestion => ({
  id: q.id,
  prompt: q.prompt,
  options: q.options,
  points: q.points,
  multiple: q.correct.length > 1,
});

/** Close attempts whose time ran out without a submission (they score what was saved: nothing). */
async function closeExpired(deps: Deps, quiz: QuizRow, userId: string) {
  if (!quiz.timeLimitSec) return;
  const cutoff = new Date(deps.now().getTime() - (quiz.timeLimitSec + QUIZ_GRACE_SECONDS) * 1000);
  await deps.db.quizAttempt.updateMany({
    where: { quizId: quiz.id, userId, submittedAt: null, startedAt: { lt: cutoff } },
    data: { submittedAt: deps.now(), score: 0, answers: {} },
  });
}

function blockedReason(quiz: QuizRow, used: number, now: Date): QuizStudentView["blocked"] {
  if (used >= quiz.maxAttempts) return "no-attempts-left";
  if (quiz.dueAt && now > quiz.dueAt) return "past-due";
  return null;
}

function result(
  quiz: QuizRow,
  attempt: { id: string; answers: Prisma.JsonValue; score: number | null; submittedAt: Date | null },
  reveal: boolean,
): AttemptResult {
  const answers = (attempt.answers ?? {}) as Answers;
  const scored = scoreQuiz(quiz.questions, answers);
  return {
    id: attempt.id,
    score: attempt.score ?? scored.score,
    max: scored.max,
    submittedAt: attempt.submittedAt!,
    questions: attemptQuestions(quiz, attempt.id).map((q) => ({
      ...toQuestion(q),
      chosen: answers[q.id] ?? [],
      right: scored.correctIds.includes(q.id),
      correctOptions: reveal ? q.correct : null,
    })),
  };
}

export async function getQuizForStudent(deps: Deps, actor: Actor, quizId: string): Promise<QuizStudentView> {
  const { quiz, manage } = await load(deps, actor, quizId);
  if (!manage) await closeExpired(deps, quiz, actor.id);
  const attempts = manage
    ? []
    : await deps.db.quizAttempt.findMany({
        where: { quizId, userId: actor.id },
        select: { id: true, answers: true, score: true, startedAt: true, submittedAt: true },
        orderBy: { startedAt: "desc" },
      });
  const submitted = attempts.filter((a) => a.submittedAt);
  const openRow = attempts.find((a) => !a.submittedAt);
  const now = deps.now();
  const blocked = blockedReason(quiz, submitted.length, now);
  const reveal = blocked !== null;
  return {
    quiz: {
      id: quiz.id,
      courseId: quiz.courseId,
      courseTitle: quiz.course.title,
      title: quiz.title,
      questionCount: quiz.questions.length,
      maxPoints: maxPointsOf(quiz),
      timeLimitSec: quiz.timeLimitSec,
      dueAt: quiz.dueAt,
      maxAttempts: quiz.maxAttempts,
    },
    canManage: manage,
    attemptsUsed: submitted.length,
    blocked: openRow ? null : blocked,
    open: openRow
      ? {
          id: openRow.id,
          deadline: attemptDeadline(openRow.startedAt, quiz.timeLimitSec),
          questions: attemptQuestions(quiz, openRow.id).map(toQuestion),
        }
      : null,
    last: submitted[0] ? result(quiz, submitted[0], reveal) : null,
    best: submitted.length ? Math.max(...submitted.map((a) => a.score ?? 0)) : null,
  };
}

/** Start an attempt (or return the one in progress). */
export async function startAttempt(deps: Deps, actor: Actor, quizId: string): Promise<{ attemptId: string }> {
  if (actor.role !== "STUDENT") throw Errors.forbidden("Only students take quizzes.");
  const { quiz } = await load(deps, actor, quizId);
  await closeExpired(deps, quiz, actor.id);
  const open = await deps.db.quizAttempt.findFirst({
    where: { quizId, userId: actor.id, submittedAt: null },
    select: { id: true },
  });
  if (open) return { attemptId: open.id };
  const used = await deps.db.quizAttempt.count({
    where: { quizId, userId: actor.id, submittedAt: { not: null } },
  });
  const blocked = blockedReason(quiz, used, deps.now());
  if (blocked === "no-attempts-left") throw Errors.conflict("You've used all your attempts for this quiz.");
  if (blocked === "past-due") throw Errors.conflict("This quiz is closed: its due date has passed.");
  const attempt = await deps.db.quizAttempt.create({
    data: { quizId, userId: actor.id, answers: {}, startedAt: deps.now() },
    select: { id: true },
  });
  return { attemptId: attempt.id };
}

/** Submit and score an attempt. Answers after the time limit (plus grace) are ignored. */
export async function submitAttempt(
  deps: Deps,
  actor: Actor,
  attemptId: string,
  input: SubmitQuizInput,
): Promise<AttemptResult> {
  const attempt = await deps.db.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, quizId: true, userId: true, startedAt: true, submittedAt: true },
  });
  if (!attempt || attempt.userId !== actor.id) throw Errors.notFound("Attempt");
  if (attempt.submittedAt) throw Errors.conflict("This attempt was already submitted.");
  const { quiz } = await load(deps, actor, attempt.quizId);

  const deadline = attemptDeadline(attempt.startedAt, quiz.timeLimitSec);
  const late = deadline && deps.now().getTime() > deadline.getTime() + QUIZ_GRACE_SECONDS * 1000;
  const ids = new Set(quiz.questions.map((q) => q.id));
  const answers: Answers = late
    ? {}
    : Object.fromEntries(Object.entries(input.answers).filter(([qid]) => ids.has(qid)));
  const { score } = scoreQuiz(quiz.questions, answers);

  // Claim the attempt atomically so a double submit can't score twice.
  const claimed = await deps.db.quizAttempt.updateMany({
    where: { id: attempt.id, submittedAt: null },
    data: { answers, score, submittedAt: deps.now() },
  });
  if (claimed.count === 0) throw Errors.conflict("This attempt was already submitted.");
  const used = await deps.db.quizAttempt.count({
    where: { quizId: quiz.id, userId: actor.id, submittedAt: { not: null } },
  });
  return result(
    quiz,
    { id: attempt.id, answers, score, submittedAt: deps.now() },
    blockedReason(quiz, used, deps.now()) !== null,
  );
}

export interface QuizResultsRow {
  userId: string;
  name: string;
  attempts: number;
  best: number | null;
  lastAt: Date | null;
}

/** Staff: every student's best score. */
export async function quizResults(
  deps: Deps,
  actor: Actor,
  quizId: string,
): Promise<{ maxPoints: number; rows: QuizResultsRow[] }> {
  assertCan(actor.role, "course:manage");
  const { quiz, manage } = await load(deps, actor, quizId);
  if (!manage) throw Errors.notFound("Quiz");
  const [enrolled, attempts] = await Promise.all([
    deps.db.enrollment.findMany({
      where: { courseId: quiz.courseId, revokedAt: null, user: { deletedAt: null } },
      select: { user: { select: { id: true, name: true } } },
    }),
    deps.db.quizAttempt.findMany({
      where: { quizId, submittedAt: { not: null } },
      select: { score: true, submittedAt: true, user: { select: { id: true, name: true } } },
    }),
  ]);
  const people = new Map(
    [...enrolled.map((e) => e.user), ...attempts.map((a) => a.user)].map((u) => [u.id, u]),
  );
  return {
    maxPoints: maxPointsOf(quiz),
    rows: [...people.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => {
        const mine = attempts.filter((a) => a.user.id === u.id);
        return {
          userId: u.id,
          name: u.name,
          attempts: mine.length,
          best: mine.length ? Math.max(...mine.map((a) => a.score ?? 0)) : null,
          lastAt: mine.reduce<Date | null>((d, a) => (!d || a.submittedAt! > d ? a.submittedAt : d), null),
        };
      }),
  };
}
