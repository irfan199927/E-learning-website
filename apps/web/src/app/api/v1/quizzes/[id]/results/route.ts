import { route } from "@/lib/http";
import { quizResults } from "@/server/services/quizzes";

type Params = { id: string };

/** GET /api/v1/quizzes/:id/results — each student's attempts and best score (staff). */
export const GET = route<Params>(async ({ deps, actor, params }) => quizResults(deps, actor, params.id), {
  roles: ["TEACHER", "ADMIN"],
});
