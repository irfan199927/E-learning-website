import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { makeDeps, world } from "@/test/fakes";
import { getGradebook, getMyGrades, gradebookCsv } from "./gradebook";

const DAY = 86_400_000;

describe("gradebook (integration)", () => {
  it("shows every student's marks with totals, and exports them as audited CSV", async () => {
    const w = await world();
    const deps = makeDeps();
    const db = deps.db;
    const now = deps.now().getTime();
    // A second enrolled student (named so they sort first), and one who was removed.
    const [amit, gone] = await Promise.all(
      ['Amit, "A"', "Gone"].map((name) =>
        db.user.create({
          data: { email: `${randomUUID()}@test.local`, name, role: "STUDENT", emailVerified: true },
        }),
      ),
    );
    await db.enrollment.createMany({
      data: [
        { userId: amit!.id, courseId: w.course.id },
        { userId: gone!.id, courseId: w.course.id, revokedAt: new Date() },
      ],
    });

    const assignment = (title: string, dueAt: number, maxPoints: number, published = true) =>
      db.assignment.create({
        data: {
          courseId: w.course.id,
          title,
          instructions: "-",
          dueAt: new Date(dueAt),
          maxPoints,
          publishedAt: published ? new Date() : null,
        },
      });
    const essay = await assignment("Essay", now - 2 * DAY, 20);
    const lab = await assignment("Lab", now - DAY, 10);
    await assignment("Next week", now + 7 * DAY, 10);
    await assignment("Draft", now - DAY, 10, false);
    const quiz = await db.quiz.create({
      data: {
        courseId: w.course.id,
        title: "Quick quiz",
        publishedAt: new Date(),
        questions: {
          create: [
            { prompt: "a", options: ["x", "y"], correct: [0], points: 2, position: 0 },
            { prompt: "b", options: ["x", "y"], correct: [1], points: 3, position: 1 },
          ],
        },
      },
    });

    await db.submission.createMany({
      data: [
        {
          assignmentId: essay.id,
          userId: w.student.id,
          status: "GRADED",
          score: 15,
          submittedAt: new Date(),
        },
        { assignmentId: lab.id, userId: w.student.id, status: "LATE", submittedAt: new Date() },
        { assignmentId: essay.id, userId: amit!.id, status: "DRAFT" }, // a draft is nothing handed in
      ],
    });
    await db.quizAttempt.createMany({
      data: [
        { quizId: quiz.id, userId: w.student.id, answers: {}, score: 2, submittedAt: new Date() },
        { quizId: quiz.id, userId: w.student.id, answers: {}, score: 5, submittedAt: new Date() },
        { quizId: quiz.id, userId: w.student.id, answers: {}, score: null, submittedAt: null }, // in progress
      ],
    });

    const book = await getGradebook(deps, w.teacher, w.course.id);
    expect(book.items.map((i) => [i.title, i.maxPoints])).toEqual([
      ["Essay", 20],
      ["Lab", 10],
      ["Next week", 10],
      ["Quick quiz", 5], // no closing date: last
    ]);
    expect(book.students.map((s) => s.name)).toEqual(['Amit, "A"', "student"]);
    const [a, s] = book.students;
    expect(s!.cells.map((c) => c.status)).toEqual(["graded", "to-grade", "open", "graded"]);
    expect(s!.cells[1]!.late).toBe(true);
    expect(s!.cells[3]!.score).toBe(5); // best attempt
    expect(s!.total).toEqual({ earned: 20, possible: 25, percent: 80 });
    expect(a!.cells.map((c) => c.status)).toEqual(["missing", "missing", "open", "open"]);
    expect(a!.total).toEqual({ earned: 0, possible: 30, percent: 0 });
    expect(book.averages).toEqual([7.5, 0, null, 5]);

    // Students see only their own row; other people get NOT_FOUND.
    const mine = await getMyGrades(deps, w.student, w.course.id);
    expect(mine.total).toEqual(s!.total);
    await expect(getMyGrades(deps, w.outsider, w.course.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getGradebook(deps, w.student, w.course.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getGradebook(deps, w.otherTeacher, w.course.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const { filename, csv } = await gradebookCsv(deps, w.admin, w.course.id);
    expect(filename).toMatch(/^grades-Maths-[a-f0-9]+-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = csv
      .replace(/^\uFEFF/, "")
      .trimEnd()
      .split("\r\n");
    expect(lines[0]).toBe(
      'Name,Email,"Essay (assignment, out of 20)","Lab (assignment, out of 10)",' +
        '"Next week (assignment, out of 10)","Quick quiz (quiz, out of 5)",Points,Out of,Percent',
    );
    expect(lines[1]).toMatch(/^"Amit, ""A""",[^,]+,missing,missing,,,0,30,0$/);
    expect(lines[2]).toMatch(/^student,[^,]+,15,to grade,,5,20,25,80$/);
    expect(lines).toHaveLength(3);
    const log = await db.auditLog.findFirst({
      where: { action: "grade.export", targetId: w.course.id },
      select: { actorId: true, meta: true },
    });
    expect(log).toEqual({ actorId: w.admin.id, meta: { students: 2 } });
  });
});
