import { createAssignmentSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { createAssignment, listCourseAssignments } from "@/server/services/assignments";

type Params = { id: string };

/** GET /api/v1/courses/:id/assignments — published ones for students; all for staff. */
export const GET = route<Params>(
  async ({ deps, actor, params }) => listCourseAssignments(deps, actor, params.id),
  {
    roles: ["STUDENT", "TEACHER", "ADMIN"],
  },
);

/** POST /api/v1/courses/:id/assignments — set new work. */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) =>
    createAssignment(deps, actor, params.id, await body(req, createAssignmentSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);
