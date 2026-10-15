import { createClassSchema, listClassesQuerySchema } from "@elearner/core";
import { body, query, route } from "@/lib/http";
import { listClasses, scheduleClass } from "@/server/services/classes";

/** GET /api/v1/classes?from=&to=&courseId= — classes visible to the caller in a date range. */
export const GET = route(({ req, deps, actor }) =>
  listClasses(deps, actor, query(req, listClassesQuerySchema)),
);

/** POST /api/v1/classes — schedule a class (or weekly series) with a Google Meet link. */
export const POST = route(
  async ({ req, deps, actor }) => scheduleClass(deps, actor, await body(req, createClassSchema)),
  { roles: ["TEACHER"], rateLimit: { bucket: "class-schedule", limit: 30, windowSec: 3600 } },
);
