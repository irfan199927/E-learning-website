import { updateCourseSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { updateCourse } from "@/server/services/course-content";

type Params = { id: string };

/** PATCH /api/v1/courses/:id — edit title, grade, description, colour, or list/unlist the course. */
export const PATCH = route<Params>(
  async ({ req, deps, actor, params }) =>
    updateCourse(deps, actor, params.id, await body(req, updateCourseSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);
