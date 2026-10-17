import { gradeWeightingSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { setGradeWeighting } from "@/server/services/gradebook";

type Params = { id: string };

/** PUT /api/v1/courses/:id/gradebook/weighting — { assignmentWeight: 0–100 | null (by points) }. */
export const PUT = route<Params>(
  async ({ req, deps, actor, params }) =>
    setGradeWeighting(deps, actor, params.id, await body(req, gradeWeightingSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);
