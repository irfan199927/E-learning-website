import { gradeSubmissionSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { gradeSubmission } from "@/server/services/assignments";

type Params = { id: string };

/** PATCH /api/v1/submissions/:id/grade — { score, feedback? }. Notifies the student; audited as grade.edit. */
export const PATCH = route<Params>(
  async ({ req, deps, actor, params }) =>
    gradeSubmission(deps, actor, params.id, await body(req, gradeSubmissionSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);
