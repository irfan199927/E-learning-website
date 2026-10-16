import { saveQuizSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { deleteQuiz, getQuizForStudent, updateQuiz } from "@/server/services/quizzes";

type Params = { id: string };

/** GET /api/v1/quizzes/:id — the quiz as a student sees it: attempts, an open attempt, the last result. */
export const GET = route<Params>(
  async ({ deps, actor, params }) => getQuizForStudent(deps, actor, params.id),
  {
    roles: ["STUDENT", "TEACHER", "ADMIN"],
  },
);

/** PUT /api/v1/quizzes/:id — save settings and questions (questions lock once anyone has submitted). */
export const PUT = route<Params>(
  async ({ req, deps, actor, params }) => updateQuiz(deps, actor, params.id, await body(req, saveQuizSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);

export const DELETE = route<Params>(
  async ({ deps, actor, params }) => {
    await deleteQuiz(deps, actor, params.id);
    return new Response(null, { status: 204 });
  },
  { roles: ["TEACHER", "ADMIN"] },
);
