import { route } from "@/lib/http";
import { startAttempt } from "@/server/services/quizzes";

type Params = { id: string };

/** POST /api/v1/quizzes/:id/attempts — start an attempt (or get the one in progress). */
export const POST = route<Params>(async ({ deps, actor, params }) => startAttempt(deps, actor, params.id), {
  roles: ["STUDENT"],
  rateLimit: { bucket: "quiz-attempt", limit: 60, windowSec: 3600 },
});
