import { createUsersSchema, listUsersQuerySchema } from "@elearner/core";
import { body, query, route } from "@/lib/http";
import { createUsers, listUsers } from "@/server/services/admin-users";

/** GET /api/v1/admin/users?q=&role=&page= — search accounts (admin). */
export const GET = route(({ req, deps, actor }) => listUsers(deps, actor, query(req, listUsersQuerySchema)), {
  roles: ["ADMIN"],
});

/** POST /api/v1/admin/users — add people ({ users: [{ email, name, role }] }); each gets a set-password email. */
export const POST = route(
  async ({ req, deps, actor }) => createUsers(deps, actor, await body(req, createUsersSchema)),
  { roles: ["ADMIN"], rateLimit: { bucket: "admin-users-create", limit: 20, windowSec: 3600 } },
);
