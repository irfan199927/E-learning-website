import { describe, expect, it } from "vitest";
import { makeDeps, world } from "@/test/fakes";
import { getGradebook, getMyGrades, setGradeExcusal, setGradeWeighting } from "./gradebook";
import { getLearnerOverview } from "./learning";
import { getSchoolSettings, updateSchoolSettings } from "./school-settings";

const DAY = 86_400_000;

describe("learning extras (integration)", () => {
  it("excuses a student from work and weighs the total by category", async () => {
    const w = await world();
    const deps = makeDeps();
    const db = deps.db;
    const now = Date.now();
    const essay = await db.assignment.create({
      data: {
        courseId: w.course.id,
        title: "Essay",
        instructions: "-",
        dueAt: new Date(now - DAY),
        maxPoints: 10,
        publishedAt: new Date(),
      },
    });
    const lab = await db.assignment.create({
      data: {
        courseId: w.course.id,
        title: "Lab",
        instructions: "-",
        dueAt: new Date(now - DAY),
        maxPoints: 10,
        publishedAt: new Date(),
      },
    });
    const quiz = await db.quiz.create({
      data: {
        courseId: w.course.id,
        title: "Quiz",
        publishedAt: new Date(),
        questions: { create: [{ prompt: "?", options: ["a", "b"], correct: [0], points: 5, position: 0 }] },
      },
    });
    await db.submission.create({
      data: {
        assignmentId: essay.id,
        userId: w.student.id,
        status: "GRADED",
        score: 10,
        submittedAt: new Date(),
      },
    });
    await db.quizAttempt.create({
      data: { quizId: quiz.id, userId: w.student.id, answers: {}, score: 1, submittedAt: new Date() },
    });

    // Lab is missing (0/10): 11 of 25 by points.
    let row = (await getGradebook(deps, w.teacher, w.course.id)).students[0]!;
    expect(row.total).toEqual({ earned: 11, possible: 25, percent: 44 });

    // Excused from the lab: left out.
    const excuse = { itemKind: "assignment" as const, itemId: lab.id, userId: w.student.id };
    await setGradeExcusal(deps, w.teacher, w.course.id, { ...excuse, excused: true });
    row = (await getGradebook(deps, w.teacher, w.course.id)).students[0]!;
    expect(row.cells.map((c) => c.status)).toEqual(["graded", "excused", "graded"]);
    expect(row.total).toEqual({ earned: 11, possible: 15, percent: 73.3 });

    // Weighted 60/40: 0.6 × 100% + 0.4 × 20% = 68%.
    await setGradeWeighting(deps, w.teacher, w.course.id, { assignmentWeight: 60 });
    expect((await getMyGrades(deps, w.student, w.course.id)).total.percent).toBe(68);
    await setGradeWeighting(deps, w.teacher, w.course.id, { assignmentWeight: null });

    // Undo; only the course's staff, only enrolled students, only the course's items.
    await setGradeExcusal(deps, w.teacher, w.course.id, { ...excuse, excused: false });
    expect((await getGradebook(deps, w.teacher, w.course.id)).students[0]!.total.possible).toBe(25);
    await expect(
      setGradeExcusal(deps, w.otherTeacher, w.course.id, { ...excuse, excused: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      setGradeExcusal(deps, w.teacher, w.course.id, { ...excuse, userId: w.outsider.id, excused: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      setGradeExcusal(deps, w.teacher, w.course.id, { ...excuse, itemKind: "quiz", excused: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("uses the school's daily goal and counts questions answered today", async () => {
    const w = await world();
    const deps = makeDeps();
    const before = await getSchoolSettings(deps);
    await expect(updateSchoolSettings(deps, w.teacher, { dailyGoalMinutes: 45 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await updateSchoolSettings(deps, w.admin, { dailyGoalMinutes: 45 });

    const quiz = await deps.db.quiz.create({
      data: { courseId: w.course.id, title: "Q", publishedAt: new Date() },
    });
    await deps.db.quizAttempt.createMany({
      data: [
        {
          quizId: quiz.id,
          userId: w.student.id,
          answers: { a: [0], b: [1], c: [] },
          score: 1,
          submittedAt: new Date(),
        },
        {
          quizId: quiz.id,
          userId: w.student.id,
          answers: { a: [0] },
          score: 0,
          submittedAt: new Date(Date.now() - 3 * DAY),
        },
        { quizId: quiz.id, userId: w.student.id, answers: { a: [0] }, score: null, submittedAt: null }, // in progress
      ],
    });
    const overview = await getLearnerOverview(deps, w.student);
    expect(overview).toMatchObject({ goalMinutes: 45, questionsToday: 3 });

    await updateSchoolSettings(deps, w.admin, { dailyGoalMinutes: before.dailyGoalMinutes });
  });
});
