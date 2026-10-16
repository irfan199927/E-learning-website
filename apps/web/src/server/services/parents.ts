/**
 * Parents: a read-only view of their children's learning, and how parents get linked to children.
 *
 * - A parent sees a child only through a VERIFIED `ParentLink`. Anything else is NOT_FOUND (no id leaks).
 * - Links are verified when an admin links them (Users page), or when a parent who has an account gives
 *   parental consent from the emailed link (the link proves they control that email), or when an admin adds a
 *   parent account whose email already gave consent for a student.
 * - The view reuses the learner read models (learning.ts) for the child, so parents see exactly the numbers the
 *   child sees: streak, today's watch time, monthly activity and per-course progress. Plus class attendance.
 */
import { assertCan, Errors, type LinkChildInput } from "@elearner/core";
import { ClassStatus, ConsentType, Role, type Db } from "@elearner/db";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { getLearnerOverview, listMyCourses, type CourseCard, type LearnerOverview } from "./learning";

export const ATTENDANCE_DAYS = 30;

interface Child {
  id: string;
  name: string;
  email: string;
  timezone: string;
  relation: string;
}

async function verifiedChildren(db: Db, parentId: string): Promise<Child[]> {
  const links = await db.parentLink.findMany({
    where: { parentId, verifiedAt: { not: null }, student: { deletedAt: null, role: Role.STUDENT } },
    select: {
      relation: true,
      student: { select: { id: true, name: true, email: true, timezone: true } },
    },
    orderBy: { student: { name: "asc" } },
  });
  return links.map((l) => ({ ...l.student, relation: l.relation }));
}

/** The child as an Actor, so the learner read models compute their numbers in the child's own timezone. */
function asLearner(child: Child): Actor {
  return { id: child.id, role: Role.STUDENT, email: child.email, name: child.name, timezone: child.timezone };
}

export interface ChildSummary {
  id: string;
  name: string;
  streak: number;
  todaySeconds: number;
  lessonsCompleted: number;
  coursesInProgress: number;
  courseCount: number;
}

/** A parent's linked children with headline numbers (Overview and /children). */
export async function listChildren(deps: Deps, actor: Actor): Promise<ChildSummary[]> {
  if (actor.role !== Role.PARENT) return [];
  const children = await verifiedChildren(deps.db, actor.id);
  return Promise.all(
    children.map(async (c) => {
      const learner = asLearner(c);
      const [o, courses] = await Promise.all([
        getLearnerOverview(deps, learner),
        listMyCourses(deps, learner),
      ]);
      return {
        id: c.id,
        name: c.name,
        streak: o.streak,
        todaySeconds: o.todaySeconds,
        lessonsCompleted: o.lessonsCompleted,
        coursesInProgress: o.coursesInProgress,
        courseCount: courses.length,
      };
    }),
  );
}

export interface AttendanceRow {
  classId: string;
  title: string;
  courseTitle: string;
  startsAt: Date;
  /** null: nothing recorded (attendance comes from Google Meet, or a teacher marks it). */
  present: boolean | null;
  minutes: number;
}

export interface ChildProgress {
  child: { id: string; name: string; relation: string };
  overview: LearnerOverview;
  courses: CourseCard[];
  attendance: { rows: AttendanceRow[]; attended: number; recorded: number };
}

/** One child's progress. Only for a parent with a verified link to that child. */
export async function getChildProgress(
  deps: Deps,
  actor: Actor,
  childId: string,
  opts: { month?: string } = {},
): Promise<ChildProgress> {
  if (actor.role !== Role.PARENT) throw Errors.notFound("Child");
  const child = (await verifiedChildren(deps.db, actor.id)).find((c) => c.id === childId);
  if (!child) throw Errors.notFound("Child");
  const learner = asLearner(child);
  const now = deps.now();

  const [overview, courses, classes] = await Promise.all([
    getLearnerOverview(deps, learner, opts),
    listMyCourses(deps, learner),
    // Past classes of the child's current courses.
    deps.db.classSession.findMany({
      where: {
        status: { not: ClassStatus.CANCELLED },
        endsAt: { lt: now, gt: new Date(now.getTime() - ATTENDANCE_DAYS * 86_400_000) },
        course: { enrollments: { some: { userId: child.id, revokedAt: null } } },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        course: { select: { title: true } },
        attendances: { where: { userId: child.id }, select: { present: true, durationSeconds: true } },
      },
      orderBy: { startsAt: "desc" },
      take: 100,
    }),
  ]);

  const rows: AttendanceRow[] = classes.map((c) => {
    const a = c.attendances[0];
    return {
      classId: c.id,
      title: c.title,
      courseTitle: c.course.title,
      startsAt: c.startsAt,
      present: a ? a.present : null,
      minutes: a ? Math.round(a.durationSeconds / 60) : 0,
    };
  });
  return {
    child: { id: child.id, name: child.name, relation: child.relation },
    overview,
    courses,
    attendance: {
      rows,
      attended: rows.filter((r) => r.present === true).length,
      recorded: rows.filter((r) => r.present !== null).length,
    },
  };
}

// ── Linking (admins) ──

export interface ParentLinkRow {
  id: string;
  studentId: string;
  name: string;
  email: string;
}

/** Link a parent account to a student by the student's email. Admin-made links are verified at once. */
export async function linkChild(
  deps: Deps,
  actor: Actor,
  parentId: string,
  input: LinkChildInput,
): Promise<ParentLinkRow> {
  assertCan(actor.role, "user:manage");
  const email = input.studentEmail.trim().toLowerCase();
  const parent = await deps.db.user.findFirst({
    where: { id: parentId, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!parent) throw Errors.notFound("User");
  if (parent.role !== Role.PARENT) throw Errors.conflict("Only parent accounts can be linked to students.");
  const student = await deps.db.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!student || student.role !== Role.STUDENT)
    throw Errors.validation("No student has that email address.");

  const link = await deps.db.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
    create: { parentId: parent.id, studentId: student.id, verifiedAt: deps.now() },
    update: { verifiedAt: deps.now() },
    select: { id: true },
  });
  await audit(deps.db, actor, "parent.link", { type: "ParentLink", id: link.id }, { studentId: student.id });
  return { id: link.id, studentId: student.id, name: student.name, email: student.email };
}

export async function unlinkChild(deps: Deps, actor: Actor, linkId: string): Promise<void> {
  assertCan(actor.role, "user:manage");
  const link = await deps.db.parentLink.findUnique({
    where: { id: linkId },
    select: { id: true, studentId: true },
  });
  if (!link) throw Errors.notFound("Link");
  await deps.db.parentLink.delete({ where: { id: link.id } });
  await audit(
    deps.db,
    actor,
    "parent.unlink",
    { type: "ParentLink", id: link.id },
    { studentId: link.studentId },
  );
}

/**
 * Verified links for a parent email that gave consent: called after a parent consents (if they have an
 * account) and after an admin adds a parent account (for consents given earlier). Returns how many it made.
 */
export async function linkByConsentEmail(db: Db, parentEmail: string, now: Date): Promise<number> {
  const email = parentEmail.trim().toLowerCase();
  const parent = await db.user.findFirst({
    where: { email, role: Role.PARENT, deletedAt: null },
    select: { id: true },
  });
  if (!parent) return 0;
  const consents = await db.consent.findMany({
    where: {
      type: ConsentType.PARENTAL_VERIFIABLE,
      withdrawnAt: null,
      parentEmail: { equals: email, mode: "insensitive" },
      user: { role: Role.STUDENT, deletedAt: null },
    },
    select: { userId: true },
  });
  for (const { userId } of consents) {
    await db.parentLink.upsert({
      where: { parentId_studentId: { parentId: parent.id, studentId: userId } },
      create: { parentId: parent.id, studentId: userId, verifiedAt: now },
      update: {},
    });
  }
  // A link that existed unverified is verified now; verified ones keep their original date.
  await db.parentLink.updateMany({
    where: { parentId: parent.id, studentId: { in: consents.map((c) => c.userId) }, verifiedAt: null },
    data: { verifiedAt: now },
  });
  return consents.length;
}
