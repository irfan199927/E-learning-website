import { gradeExcusalSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { setGradeExcusal } from "@/server/services/gradebook";

type Params = { id: string };

/** PUT /api/v1/courses/:id/gradebook/excusals — excuse a student from one item, or undo ({ ..., excused }). */
export const PUT = route<Params>(
  async ({ req, deps, actor, params }) =>
    setGradeExcusal(deps, actor, params.id, await body(req, gradeExcusalSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);
