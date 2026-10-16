import { route } from "@/lib/http";
import { setLessonDone } from "@/server/services/learning";

type Params = { id: string };

/** PUT /api/v1/lessons/:id/progress — a student marks a text, link or file lesson as done. */
export const PUT = route<Params>(
  async ({ deps, actor, params }) => setLessonDone(deps, actor, params.id, true),
  { roles: ["STUDENT"] },
);

/** DELETE /api/v1/lessons/:id/progress — undo "done". */
export const DELETE = route<Params>(
  async ({ deps, actor, params }) => setLessonDone(deps, actor, params.id, false),
  { roles: ["STUDENT"] },
);
