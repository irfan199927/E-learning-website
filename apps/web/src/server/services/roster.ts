/**
 * A course's students, for its teacher (or an admin): who is enrolled, and removing someone.
 * Removing keeps the Enrollment row with `revokedAt` set (history stays; access stops at once).
 * The student can ask to join again, which the teacher approves or declines as usual.
 */
import { assertCan, Errors } from "@elearner/core";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess } from "../policies";

export interface RosterStudent {
  userId: string;
  name: string;
  email: string;
  enrolledAt: Date;
}

export async function listRoster(deps: Deps, actor: Actor, courseId: string): Promise<RosterStudent[]> {
  assertCan(actor.role, "course:manage");
  await assertCourseAccess(deps.db, actor, courseId, "manage");
  const rows = await deps.db.enrollment.findMany({
    where: { courseId, revokedAt: null },
    select: { enrolledAt: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
    take: 1000,
  });
  return rows.map((r) => ({
    userId: r.user.id,
    name: r.user.name,
    email: r.user.email,
    enrolledAt: r.enrolledAt,
  }));
}

export async function removeStudent(
  deps: Deps,
  actor: Actor,
  courseId: string,
  userId: string,
): Promise<void> {
  assertCan(actor.role, "course:manage");
  await assertCourseAccess(deps.db, actor, courseId, "manage");
  const { count } = await deps.db.enrollment.updateMany({
    where: { courseId, userId, revokedAt: null },
    data: { revokedAt: deps.now() },
  });
  if (count === 0) throw Errors.notFound("Student");
  await audit(deps.db, actor, "enrollment.remove", { type: "Course", id: courseId }, { userId });
}
