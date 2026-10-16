import { saveQuizSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { createQuiz, listCourseQuizzes } from "@/server/services/quizzes";

type Params = { id: string };

/** GET /api/v1/courses/:id/quizzes — published ones for students; all for staff. */
export const GET = route<Params>(
  async ({ deps, actor, params }) => listCourseQuizzes(deps, actor, params.id),
  {
    roles: ["STUDENT", "TEACHER", "ADMIN"],
  },
);

/** POST /api/v1/courses/:id/quizzes — a new MCQ quiz with its questions. */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) => createQuiz(deps, actor, params.id, await body(req, saveQuizSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);
