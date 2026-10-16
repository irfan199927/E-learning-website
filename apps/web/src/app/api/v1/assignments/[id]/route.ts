import { updateAssignmentSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { deleteAssignment, getAssignment, updateAssignment } from "@/server/services/assignments";

type Params = { id: string };

/** GET /api/v1/assignments/:id — students get their own submission; staff get every student's. */
export const GET = route<Params>(async ({ deps, actor, params }) => getAssignment(deps, actor, params.id), {
  roles: ["STUDENT", "TEACHER", "ADMIN"],
});

/** PATCH /api/v1/assignments/:id — edit, publish or unpublish. */
export const PATCH = route<Params>(
  async ({ req, deps, actor, params }) =>
    updateAssignment(deps, actor, params.id, await body(req, updateAssignmentSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);

/** DELETE /api/v1/assignments/:id — with every submission and file. */
export const DELETE = route<Params>(
  async ({ deps, actor, params }) => {
    await deleteAssignment(deps, actor, params.id);
    return new Response(null, { status: 204 });
  },
  { roles: ["TEACHER", "ADMIN"] },
);
