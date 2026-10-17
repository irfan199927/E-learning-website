import { lessonOrderSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { reorderLessons } from "@/server/services/course-content";

type Params = { id: string };

/** PUT /api/v1/modules/:id/lesson-order — the module's lessons in their new order ({ lessonIds }). */
export const PUT = route<Params>(
  async ({ req, deps, actor, params }) => {
    await reorderLessons(deps, actor, params.id, await body(req, lessonOrderSchema));
    return new Response(null, { status: 204 });
  },
  { roles: ["TEACHER", "ADMIN"] },
);
