import { missingScopes } from "@elearner/google";
import type { Actor, Deps } from "../deps";

/** Courses the actor can schedule classes / upload videos for. */
export async function listManageableCourses(deps: Deps, actor: Actor) {
  if (actor.role !== "TEACHER" && actor.role !== "ADMIN") return [];
  return deps.db.course.findMany({
    where: actor.role === "ADMIN" ? {} : { teacherId: actor.id },
    select: {
      id: true,
      title: true,
      color: true,
      modules: { orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true, title: true } },
      _count: { select: { enrollments: { where: { revokedAt: null } } } },
    },
    orderBy: { title: "asc" },
  });
}

export async function isGoogleConnected(deps: Deps, userId: string): Promise<boolean> {
  const row = await deps.db.googleCredential.findUnique({
    where: { userId },
    select: { revokedAt: true, scopes: true },
  });
  // A grant from before a scope was added counts as not connected, so the teacher is asked to reconnect.
  return !!row && !row.revokedAt && missingScopes(row.scopes).length === 0;
}
