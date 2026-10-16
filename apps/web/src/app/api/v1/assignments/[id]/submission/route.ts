import { submitAssignmentSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { submitAssignment } from "@/server/services/assignments";

type Params = { id: string };

/** PUT /api/v1/assignments/:id/submission — hand in (again) with { text?, fileKeys[] }. */
export const PUT = route<Params>(
  async ({ req, deps, actor, params }) =>
    submitAssignment(deps, actor, params.id, await body(req, submitAssignmentSchema)),
  { roles: ["STUDENT"], rateLimit: { bucket: "submission", limit: 60, windowSec: 3600 } },
);
