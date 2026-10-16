import { submitQuizSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { submitAttempt } from "@/server/services/quizzes";

type Params = { id: string };

/** PUT /api/v1/attempts/:id — submit { answers: { [questionId]: optionIndexes[] } }; returns the score. */
export const PUT = route<Params>(
  async ({ req, deps, actor, params }) =>
    submitAttempt(deps, actor, params.id, await body(req, submitQuizSchema)),
  { roles: ["STUDENT"] },
);
