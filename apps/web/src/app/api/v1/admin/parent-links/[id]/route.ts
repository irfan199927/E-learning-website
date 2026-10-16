import { route } from "@/lib/http";
import { unlinkChild } from "@/server/services/parents";

type Params = { id: string };

/** DELETE /api/v1/admin/parent-links/:id — the parent stops seeing that student. */
export const DELETE = route<Params>(
  async ({ deps, actor, params }) => {
    await unlinkChild(deps, actor, params.id);
    return new Response(null, { status: 204 });
  },
  { roles: ["ADMIN"] },
);
