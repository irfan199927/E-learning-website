import { linkChildSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { linkChild } from "@/server/services/parents";

type Params = { id: string };

/** POST /api/v1/admin/users/:id/children — link a parent account to a student (by the student's email). */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) => linkChild(deps, actor, params.id, await body(req, linkChildSchema)),
  { roles: ["ADMIN"] },
);
