import { describe, expect, it } from "vitest";
import { makeDeps, world } from "@/test/fakes";
import {
  createQuiz,
  getQuizForEditing,
  getQuizForStudent,
  listCourseQuizzes,
  quizResults,
  startAttempt,
  submitAttempt,
  updateQuiz,
} from "./quizzes";

const quiz = {
  title: "Fractions check",
  maxAttempts: 2,
  shuffle: true,
  published: true,
  questions: [
    { prompt: "1/2 + 1/4 = ?", options: ["3/4", "2/6", "1/8"], correct: [0], points: 2 },
    { prompt: "Pick the fractions equal to 1/2", options: ["2/4", "3/6", "2/3"], correct: [0, 1], points: 3 },
  ],
};

describe("quizzes (integration)", () => {
  it("runs attempts, scores them, limits them and reveals answers at the end", async () => {
    const w = await world();
    const deps = makeDeps();
    const { id } = await createQuiz(deps, w.teacher, w.course.id, quiz);

    // The student never sees correct answers before submitting.
    const { attemptId } = await startAttempt(deps, w.student, id);
    let view = await getQuizForStudent(deps, w.student, id);
    expect(view.open?.id).toBe(attemptId);
    expect(JSON.stringify(view.open)).not.toContain('"correct"');
    expect(view.open?.questions.find((q) => q.prompt.startsWith("Pick"))?.multiple).toBe(true);
    // Starting again returns the same open attempt.
    expect((await startAttempt(deps, w.student, id)).attemptId).toBe(attemptId);

    const qa = view.open!.questions.find((q) => q.prompt.startsWith("1/2"))!;
    const qb = view.open!.questions.find((q) => q.prompt.startsWith("Pick"))!;
    const first = await submitAttempt(deps, w.student, attemptId, {
      answers: { [qa.id]: [0], [qb.id]: [0] },
    });
    expect(first).toMatchObject({ score: 2, max: 5 });
    expect(first.questions.every((q) => q.correctOptions === null)).toBe(true); // one attempt left: not revealed
    await expect(submitAttempt(deps, w.student, attemptId, { answers: {} })).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const second = await startAttempt(deps, w.student, id);
    const last = await submitAttempt(deps, w.student, second.attemptId, {
      answers: { [qa.id]: [0], [qb.id]: [1, 0] },
    });
    expect(last.score).toBe(5);
    expect(last.questions.find((q) => q.id === qb.id)?.correctOptions).toEqual([0, 1]); // no attempts left
    await expect(startAttempt(deps, w.student, id)).rejects.toMatchObject({ code: "CONFLICT" });

    view = await getQuizForStudent(deps, w.student, id);
    expect(view).toMatchObject({ attemptsUsed: 2, best: 5, blocked: "no-attempts-left", open: null });
    expect((await listCourseQuizzes(deps, w.student, w.course.id))[0]?.mine).toEqual({
      attempts: 2,
      best: 5,
    });

    // Staff: results, and questions are locked now.
    const results = await quizResults(deps, w.teacher, id);
    expect(results).toMatchObject({ maxPoints: 5, rows: [{ userId: w.student.id, attempts: 2, best: 5 }] });
    expect((await getQuizForEditing(deps, w.teacher, id)).locked).toBe(true);
    await expect(
      updateQuiz(deps, w.teacher, id, { ...quiz, questions: [quiz.questions[0]!] }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Settings alone can still change.
    await updateQuiz(deps, w.teacher, id, { ...quiz, title: "Fractions check (term 1)", maxAttempts: 3 });
    expect((await getQuizForStudent(deps, w.student, id)).blocked).toBeNull();
  });

  it("ignores answers after the time limit, closes past-due quizzes, and hides drafts", async () => {
    const w = await world();
    const t0 = new Date();
    const at = (s: number) => makeDeps({ now: () => new Date(t0.getTime() + s * 1000) });
    const timed = await createQuiz(at(0), w.teacher, w.course.id, {
      ...quiz,
      timeLimitMinutes: 1,
      maxAttempts: 3,
    });

    const { attemptId } = await startAttempt(at(0), w.student, timed.id);
    const view = await getQuizForStudent(at(0), w.student, timed.id);
    const qa = view.open!.questions[0]!;
    // 60 s limit + 60 s grace: at 3 minutes the answers no longer count.
    const late = await submitAttempt(at(180), w.student, attemptId, { answers: { [qa.id]: [0] } });
    expect(late.score).toBe(0);

    // An attempt left open past its time is closed (scored 0) next time the student opens the quiz.
    await startAttempt(at(200), w.student, timed.id);
    const later = await getQuizForStudent(at(500), w.student, timed.id);
    expect(later).toMatchObject({ attemptsUsed: 2, open: null });

    const pastDue = await createQuiz(at(0), w.teacher, w.course.id, {
      ...quiz,
      dueAt: new Date(t0.getTime() - 1000),
    });
    await expect(startAttempt(at(0), w.student, pastDue.id)).rejects.toMatchObject({ code: "CONFLICT" });

    const draft = await createQuiz(at(0), w.teacher, w.course.id, { ...quiz, published: false });
    await expect(getQuizForStudent(at(0), w.student, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    for (const actor of [w.outsider, w.parent, w.otherTeacher])
      await expect(getQuizForStudent(at(0), actor, timed.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(startAttempt(at(0), w.teacher, timed.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps the answer key hidden while an attempt is open, and late or parallel attempts don't score", async () => {
    const w = await world();
    const t0 = new Date();
    const at = (s: number) => makeDeps({ now: () => new Date(t0.getTime() + s * 1000) });
    const due = await createQuiz(at(0), w.teacher, w.course.id, {
      ...quiz,
      maxAttempts: 2,
      dueAt: new Date(t0.getTime() + 100_000),
    });

    const first = await startAttempt(at(0), w.student, due.id);
    await submitAttempt(at(10), w.student, first.attemptId, { answers: {} });
    // A second attempt opened just before the due date…
    const second = await startAttempt(at(90), w.student, due.id);
    // …must not see the key after the due date while it is still open,
    const view = await getQuizForStudent(at(300), w.student, due.id);
    expect(view.open?.id).toBe(second.attemptId);
    expect(view.last?.questions.every((q) => q.correctOptions === null)).toBe(true);
    // and answers sent after the due date (plus grace) don't count.
    const right = Object.fromEntries(
      view.open!.questions.map((q) => [q.id, q.prompt.startsWith("1/2") ? [0] : [0, 1]]),
    );
    const late = await submitAttempt(at(300), w.student, second.attemptId, { answers: right });
    expect(late.score).toBe(0);

    // Two starts at once share one attempt, so a one-attempt quiz can't be taken twice.
    const once = await createQuiz(at(0), w.teacher, w.course.id, { ...quiz, maxAttempts: 1 });
    const [a, b] = await Promise.all([
      startAttempt(at(0), w.student, once.id),
      startAttempt(at(0), w.student, once.id),
    ]);
    expect(a.attemptId).toBe(b.attemptId);
  });
});
