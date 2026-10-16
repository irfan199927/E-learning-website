import { updateLessonSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { deleteLesson, updateLesson } from "@/server/services/course-content";

type Params = { id: string };

/** PATCH /api/v1/lessons/:id — edit, hide/show, move to another module, or move up/down. */
export const PATCH = route<Params>(
  async ({ req, deps, actor, params }) =>
    updateLesson(deps, actor, params.id, await body(req, updateLessonSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);

/** DELETE /api/v1/lessons/:id — removes the lesson and its files; a video stays in the course. */
export const DELETE = route<Params>(
  async ({ deps, actor, params }) => {
    await deleteLesson(deps, actor, params.id);
    return new Response(null, { status: 204 });
  },
  { roles: ["TEACHER", "ADMIN"] },
);
