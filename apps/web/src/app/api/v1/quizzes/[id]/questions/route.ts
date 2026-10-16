import { route } from "@/lib/http";
import { getQuizForEditing } from "@/server/services/quizzes";

type Params = { id: string };

/** GET /api/v1/quizzes/:id/questions — the full quiz with correct answers (staff). */
export const GET = route<Params>(
  async ({ deps, actor, params }) => getQuizForEditing(deps, actor, params.id),
  {
    roles: ["TEACHER", "ADMIN"],
  },
);
