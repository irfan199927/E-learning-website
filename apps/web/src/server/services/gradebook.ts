/**
 * Gradebook: every enrolled student's marks for a course's published assignments and quizzes, with totals, for
 * the course teacher (or an admin), as a page and as a CSV download. Students get their own row only.
 *
 * - Columns: published assignments and quizzes, soonest due first (quizzes with no closing date last).
 *   A quiz scores the student's best submitted attempt.
 * - Rows: students currently enrolled. Removed students drop out (their work stays in the database).
 * - Cell and total rules are `gradeCell` / `gradeTotal` in @elearner/core.
 * - A CSV export holds names, emails and marks, so it is audited (`grade.export`).
 */
import {
  assertCan,
  Errors,
  gradeCell,
  gradeTotal,
  itemAverage,
  toCsv,
  type GradeCell,
  type GradeExcusalInput,
  type GradeFacts,
  type GradeItem,
  type GradeTotal,
  type GradeWeightingInput,
} from "@elearner/core";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess } from "../policies";

export interface GradebookStudent {
  userId: string;
  name: string;
  email: string;
  cells: GradeCell[];
  total: GradeTotal;
}

export interface Gradebook {
  course: { id: string; title: string };
  items: GradeItem[];
  students: GradebookStudent[];
  /** Per item: the class average score (missing work counts as 0), or null when nothing counts yet. */
  averages: (number | null)[];
  /** Assignments' share of the total in percent, or null when everything is weighed by points. */
  assignmentWeight: number | null;
}

const key = (itemId: string, userId: string) => `${itemId}:${userId}`;

/** Published items and what each of `userIds` has done on them. */
async function load(deps: Deps, courseId: string, userIds: string[]) {
  const [assignments, quizzes] = await Promise.all([
    deps.db.assignment.findMany({
      where: { courseId, publishedAt: { not: null } },
      select: {
        id: true,
        title: true,
        maxPoints: true,
        dueAt: true,
        submissions: {
          where: { userId: { in: userIds }, status: { not: "DRAFT" } },
          select: { userId: true, status: true, score: true },
        },
      },
      take: 200,
    }),
    deps.db.quiz.findMany({
      where: { courseId, publishedAt: { not: null } },
      select: { id: true, title: true, dueAt: true, questions: { select: { points: true } } },
      take: 200,
    }),
  ]);
  const best = quizzes.length
    ? await deps.db.quizAttempt.groupBy({
        by: ["quizId", "userId"],
        where: {
          quizId: { in: quizzes.map((q) => q.id) },
          userId: { in: userIds },
          submittedAt: { not: null },
        },
        _max: { score: true },
      })
    : [];

  const excusals = await deps.db.gradeExcusal.findMany({
    where: { courseId, userId: { in: userIds } },
    select: { itemId: true, userId: true },
  });
  const facts = new Map<string, GradeFacts>();
  for (const a of assignments)
    for (const s of a.submissions)
      if (s.status !== "DRAFT") facts.set(key(a.id, s.userId), { status: s.status, score: s.score });
  for (const b of best) facts.set(key(b.quizId, b.userId), { status: "GRADED", score: b._max.score ?? 0 });
  for (const e of excusals) {
    const k = key(e.itemId, e.userId);
    facts.set(k, { ...(facts.get(k) ?? { status: null, score: null }), excused: true });
  }

  const items: GradeItem[] = [
    ...assignments.map(
      (a): GradeItem => ({
        kind: "assignment",
        id: a.id,
        title: a.title,
        maxPoints: a.maxPoints,
        dueAt: a.dueAt,
      }),
    ),
    ...quizzes.map(
      (q): GradeItem => ({
        kind: "quiz",
        id: q.id,
        title: q.title,
        maxPoints: q.questions.reduce((n, x) => n + x.points, 0),
        dueAt: q.dueAt,
      }),
    ),
  ].sort(
    (a, b) =>
      (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) || a.title.localeCompare(b.title),
  );
  return { items, facts };
}

/** The whole course gradebook (staff). */
export async function getGradebook(deps: Deps, actor: Actor, courseId: string): Promise<Gradebook> {
  assertCan(actor.role, "course:manage");
  await assertCourseAccess(deps.db, actor, courseId, "manage");
  const [course, enrolled] = await Promise.all([
    deps.db.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { id: true, title: true, assignmentWeight: true },
    }),
    deps.db.enrollment.findMany({
      where: { courseId, revokedAt: null, user: { deletedAt: null } },
      select: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
      take: 1000,
    }),
  ]);
  const { items, facts } = await load(
    deps,
    courseId,
    enrolled.map((e) => e.user.id),
  );
  const now = deps.now();
  const students = enrolled.map(({ user }) => {
    const cells = items.map((item) => gradeCell(item, facts.get(key(item.id, user.id)), now));
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      cells,
      total: gradeTotal(items, cells, course.assignmentWeight),
    };
  });
  return {
    course: { id: course.id, title: course.title },
    items,
    students,
    averages: items.map((_, i) => itemAverage(students.map((s) => s.cells[i]!))),
    assignmentWeight: course.assignmentWeight,
  };
}

export interface MyGrades {
  course: { id: string; title: string };
  items: GradeItem[];
  cells: GradeCell[];
  total: GradeTotal;
  assignmentWeight: number | null;
}

/** A student's own row. */
export async function getMyGrades(deps: Deps, actor: Actor, courseId: string): Promise<MyGrades> {
  if (actor.role !== "STUDENT") throw Errors.notFound("Course");
  await assertCourseAccess(deps.db, actor, courseId, "watch");
  const [course, { items, facts }] = await Promise.all([
    deps.db.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { id: true, title: true, assignmentWeight: true },
    }),
    load(deps, courseId, [actor.id]),
  ]);
  const cells = items.map((item) => gradeCell(item, facts.get(key(item.id, actor.id)), deps.now()));
  return {
    course: { id: course.id, title: course.title },
    items,
    cells,
    total: gradeTotal(items, cells, course.assignmentWeight),
    assignmentWeight: course.assignmentWeight,
  };
}

const CELL_TEXT: Record<GradeCell["status"], string> = {
  graded: "",
  "to-grade": "to grade",
  missing: "missing",
  open: "",
  excused: "excused",
};

/** The gradebook as CSV: one row per student, a score column per item, then the total. */
export async function gradebookCsv(
  deps: Deps,
  actor: Actor,
  courseId: string,
): Promise<{ filename: string; csv: string }> {
  const book = await getGradebook(deps, actor, courseId);
  const header = [
    "Name",
    "Email",
    ...book.items.map((i) => `${i.title} (${i.kind}, out of ${i.maxPoints})`),
    "Points",
    "Out of",
    "Percent",
  ];
  const rows = book.students.map((s) => [
    s.name,
    s.email,
    ...s.cells.map((c) => (c.status === "graded" ? c.score : CELL_TEXT[c.status])),
    s.total.earned,
    s.total.possible,
    s.total.percent,
  ]);
  await audit(deps.db, actor, "grade.export", { type: "Course", id: courseId }, { students: rows.length });
  const slug = book.course.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course";
  const day = deps.now().toISOString().slice(0, 10);
  return { filename: `grades-${slug}-${day}.csv`, csv: toCsv([header, ...rows]) };
}

/** Staff: excuse a student from one assignment or quiz (left out of their total), or undo it. */
export async function setGradeExcusal(
  deps: Deps,
  actor: Actor,
  courseId: string,
  input: GradeExcusalInput,
): Promise<{ excused: boolean }> {
  assertCan(actor.role, "course:manage");
  await assertCourseAccess(deps.db, actor, courseId, "manage");
  const item =
    input.itemKind === "assignment"
      ? await deps.db.assignment.findFirst({ where: { id: input.itemId, courseId }, select: { id: true } })
      : await deps.db.quiz.findFirst({ where: { id: input.itemId, courseId }, select: { id: true } });
  if (!item) throw Errors.notFound(input.itemKind === "assignment" ? "Assignment" : "Quiz");
  const enrolled = await deps.db.enrollment.count({
    where: { courseId, userId: input.userId, revokedAt: null },
  });
  if (!enrolled) throw Errors.notFound("Student");
  const where = {
    itemKind_itemId_userId: { itemKind: input.itemKind, itemId: input.itemId, userId: input.userId },
  };
  if (input.excused)
    await deps.db.gradeExcusal.upsert({
      where,
      create: {
        courseId,
        itemKind: input.itemKind,
        itemId: input.itemId,
        userId: input.userId,
        createdById: actor.id,
      },
      update: {},
    });
  else await deps.db.gradeExcusal.deleteMany({ where: where.itemKind_itemId_userId });
  await audit(
    deps.db,
    actor,
    input.excused ? "grade.excuse" : "grade.unexcuse",
    { type: "Course", id: courseId },
    {
      itemKind: input.itemKind,
      itemId: input.itemId,
      userId: input.userId,
    },
  );
  return { excused: input.excused };
}

/** Staff: weigh the total by points (null) or give assignments a share in percent (quizzes get the rest). */
export async function setGradeWeighting(
  deps: Deps,
  actor: Actor,
  courseId: string,
  input: GradeWeightingInput,
): Promise<{ assignmentWeight: number | null }> {
  assertCan(actor.role, "course:manage");
  await assertCourseAccess(deps.db, actor, courseId, "manage");
  await deps.db.course.update({
    where: { id: courseId },
    data: { assignmentWeight: input.assignmentWeight },
  });
  await audit(
    deps.db,
    actor,
    "grade.weighting",
    { type: "Course", id: courseId },
    {
      assignmentWeight: input.assignmentWeight,
    },
  );
  return { assignmentWeight: input.assignmentWeight };
}
