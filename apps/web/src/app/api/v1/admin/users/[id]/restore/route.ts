import { route } from "@/lib/http";
import { cancelAccountDeletion } from "@/server/services/account";

type Params = { id: string };

/** POST /api/v1/admin/users/:id/restore — cancel a deletion request before the purge (admin). */
export const POST = route<Params>(
  async ({ deps, actor, params }) => {
    await cancelAccountDeletion(deps, actor, params.id);
    return new Response(null, { status: 204 });
  },
  { roles: ["ADMIN"] },
);
