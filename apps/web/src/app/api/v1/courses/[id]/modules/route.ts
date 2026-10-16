import { createModuleSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { createModule } from "@/server/services/course-content";

type Params = { id: string };

/** POST /api/v1/courses/:id/modules — add a module at the end of the course. */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) =>
    createModule(deps, actor, params.id, await body(req, createModuleSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);
