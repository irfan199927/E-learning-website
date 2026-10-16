import { route } from "@/lib/http";
import { resendInvite } from "@/server/services/admin-users";

type Params = { id: string };

/** POST /api/v1/admin/users/:id/invite — email the "choose a password" link again (admin). */
export const POST = route<Params>(
  async ({ deps, actor, params }) => {
    await resendInvite(deps, actor, params.id);
    return new Response(null, { status: 204 });
  },
  { roles: ["ADMIN"], rateLimit: { bucket: "admin-invite", limit: 60, windowSec: 3600 } },
);
