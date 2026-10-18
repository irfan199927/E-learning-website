/**
 * "Needs your attention" on the staff Overview: counts of work waiting on this teacher (or, for an admin, on the
 * school), each with a link to the first place to act. Read-only; items with nothing waiting are left out.
 */
import { Errors } from "@elearner/core";
import {
  ClassStatus,
  JoinRequestStatus,
  ManualPaymentStatus,
  type Prisma,
  Role,
  SubmissionStatus,
} from "@elearner/db";
import type { Actor, Deps } from "../deps";

/** Classes older than this no longer nag for attendance. */
export const ATTENDANCE_LOOKBACK_DAYS = 14;

export type AttentionKey = "grade" | "joinRequests" | "attendance" | "payments" | "deletions";

export interface AttentionItem {
  key: AttentionKey;
  count: number;
  /** Where to act first: the oldest waiting item. */
  href: string;
}

export interface SchoolStats {
  students: number;
  teachers: number;
  courses: number;
}

export interface Attention {
  items: AttentionItem[];
  /** Admins only. */
  stats: SchoolStats | null;
}

export async function getAttention(deps: Deps, actor: Actor): Promise<Attention> {
  if (actor.role !== Role.TEACHER && actor.role !== Role.ADMIN) throw Errors.forbidden();
  const admin = actor.role === Role.ADMIN;
  // Teachers see their own courses; admins see the whole school.
  const course: Prisma.CourseWhereInput = admin ? {} : { teacherId: actor.id };
  const since = new Date(deps.now().getTime() - ATTENDANCE_LOOKBACK_DAYS * 86_400_000);

  const toGrade: Prisma.SubmissionWhereInput = {
    status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE] },
    assignment: { course },
  };
  const joinRequests: Prisma.JoinRequestWhereInput = { status: JoinRequestStatus.PENDING, course };
  // Google Meet classes fill in attendance by themselves; the rest need a teacher's marks.
  const unmarked: Prisma.ClassSessionWhereInput = {
    course,
    googleEventId: null,
    status: { not: ClassStatus.CANCELLED },
    startsAt: { gte: since },
    endsAt: { lte: deps.now() },
    attendances: { none: {} },
  };

  const [gradeCount, firstGrade, joinCount, firstJoin, classCount, firstClass] = await Promise.all([
    deps.db.submission.count({ where: toGrade }),
    deps.db.submission.findFirst({
      where: toGrade,
      orderBy: { submittedAt: "asc" },
      select: { assignmentId: true },
    }),
    deps.db.joinRequest.count({ where: joinRequests }),
    deps.db.joinRequest.findFirst({
      where: joinRequests,
      orderBy: { createdAt: "asc" },
      select: { courseId: true },
    }),
    deps.db.classSession.count({ where: unmarked }),
    deps.db.classSession.findFirst({ where: unmarked, orderBy: { startsAt: "desc" }, select: { id: true } }),
  ]);

  const items: AttentionItem[] = [];
  if (gradeCount && firstGrade)
    items.push({ key: "grade", count: gradeCount, href: `/assignments/${firstGrade.assignmentId}` });
  if (joinCount && firstJoin)
    items.push({
      key: "joinRequests",
      count: joinCount,
      href: `/courses/${firstJoin.courseId}#join-requests`,
    });
  if (classCount && firstClass)
    items.push({ key: "attendance", count: classCount, href: `/classes/${firstClass.id}/attendance` });

  if (!admin) return { items, stats: null };

  const people = { isActive: true, deletedAt: null };
  const [payments, deletions, students, teachers, courses] = await Promise.all([
    deps.db.manualPayment.count({ where: { status: ManualPaymentStatus.PENDING } }),
    deps.db.user.count({ where: { deletedAt: { not: null } } }),
    deps.db.user.count({ where: { ...people, role: Role.STUDENT } }),
    deps.db.user.count({ where: { ...people, role: Role.TEACHER } }),
    deps.db.course.count(),
  ]);
  if (payments) items.push({ key: "payments", count: payments, href: "/admin/payments" });
  if (deletions) items.push({ key: "deletions", count: deletions, href: "/admin/users" });
  return { items, stats: { students, teachers, courses } };
}
