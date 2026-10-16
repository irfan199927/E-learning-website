import { createLessonSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { createLesson } from "@/server/services/course-content";

type Params = { id: string };

/** POST /api/v1/modules/:id/lessons — add a text, link, file or (existing) video lesson at the end. */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) =>
    createLesson(deps, actor, params.id, await body(req, createLessonSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);
