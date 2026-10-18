/**
 * Resource-level access rules ("may THIS user touch THIS course?").
 * Role-level rules live in @elearner/core `can()`. Every service method calls one of these
 * before reading or writing course data — enrollment is the single gate for paid content.
 */
import { Errors } from "@elearner/core";
import type { Db } from "@elearner/db";
import type { Actor } from "./deps";

export type CourseAccess = "manage" | "watch" | "read";

/**
 * manage → course teacher (still in the TEACHER role) or admin
 * watch  → manage, or actively enrolled student
 * read   → watch, or parent of an enrolled student (schedule/attendance only)
 */
export async function hasCourseAccess(
  db: Db,
  actor: Actor,
  courseId: string,
  level: CourseAccess,
): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  const course = await db.course.findUnique({ where: { id: courseId }, select: { teacherId: true } });
  if (!course) return false;
  // Owning a course counts only while the owner is still a teacher: a teacher moved to another role loses it.
  if (course.teacherId === actor.id && actor.role === "TEACHER") return true;
  if (level === "manage") return false;

  if (actor.role === "STUDENT") {
    const enrolled = await db.enrollment.count({ where: { courseId, userId: actor.id, revokedAt: null } });
    return enrolled > 0;
  }
  if (actor.role === "PARENT" && level === "read") {
    const childEnrolled = await db.enrollment.count({
      where: {
        courseId,
        revokedAt: null,
        user: { childLinks: { some: { parentId: actor.id, verifiedAt: { not: null } } } },
      },
    });
    return childEnrolled > 0;
  }
  return false;
}

/** Throws NOT_FOUND (not FORBIDDEN) so we don't leak which course ids exist. */
export async function assertCourseAccess(
  db: Db,
  actor: Actor,
  courseId: string,
  level: CourseAccess,
): Promise<void> {
  if (!(await hasCourseAccess(db, actor, courseId, level))) throw Errors.notFound("Course");
}

/** Prisma `where` fragment: courses whose classes this actor may list. */
export function visibleCoursesWhere(actor: Actor) {
  switch (actor.role) {
    case "ADMIN":
      return {};
    case "TEACHER":
      return { teacherId: actor.id };
    case "STUDENT":
      return { enrollments: { some: { userId: actor.id, revokedAt: null } } };
    case "PARENT":
      return {
        enrollments: {
          some: {
            revokedAt: null,
            user: { childLinks: { some: { parentId: actor.id, verifiedAt: { not: null } } } },
          },
        },
      };
  }
}
