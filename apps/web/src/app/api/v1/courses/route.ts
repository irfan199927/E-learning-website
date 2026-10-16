import { createCourseSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { createCourse } from "@/server/services/join-requests";

/** POST /api/v1/courses — a teacher creates a course (published, so students can ask to join). */
export const POST = route(
  async ({ req, deps, actor }) => createCourse(deps, actor, await body(req, createCourseSchema)),
  { roles: ["TEACHER", "ADMIN"], rateLimit: { bucket: "course-create", limit: 20, windowSec: 3600 } },
);
