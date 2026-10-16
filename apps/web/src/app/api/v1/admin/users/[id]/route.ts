import { updateUserSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { updateUser } from "@/server/services/admin-users";

type Params = { id: string };

/** PATCH /api/v1/admin/users/:id — change role and/or activate/deactivate (admin). */
export const PATCH = route<Params>(
  async ({ req, deps, actor, params }) =>
    updateUser(deps, actor, params.id, await body(req, updateUserSchema)),
  { roles: ["ADMIN"] },
);
