import { updateModuleSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { deleteModule, updateModule } from "@/server/services/course-content";

type Params = { id: string };

/** PATCH /api/v1/modules/:id — rename, or move up/down. */
export const PATCH = route<Params>(
  async ({ req, deps, actor, params }) =>
    updateModule(deps, actor, params.id, await body(req, updateModuleSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);

/** DELETE /api/v1/modules/:id — only when the module has no lessons. */
export const DELETE = route<Params>(
  async ({ deps, actor, params }) => {
    await deleteModule(deps, actor, params.id);
    return new Response(null, { status: 204 });
  },
  { roles: ["TEACHER", "ADMIN"] },
);
