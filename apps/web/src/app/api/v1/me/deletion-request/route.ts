import { deleteAccountSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { requestAccountDeletion } from "@/server/services/account";

/**
 * POST /api/v1/me/deletion-request — delete my account ({ confirm: "DELETE" }). Signs out everywhere at once;
 * the data is purged after the grace period. Students and parents only.
 */
export const POST = route(
  async ({ req, deps, actor }) => requestAccountDeletion(deps, actor, await body(req, deleteAccountSchema)),
  { roles: ["STUDENT", "PARENT"], rateLimit: { bucket: "delete-account", limit: 5, windowSec: 3600 } },
);
