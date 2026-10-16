import { route } from "@/lib/http";
import { getGradebook } from "@/server/services/gradebook";

type Params = { id: string };

/** GET /api/v1/courses/:id/gradebook — every enrolled student's marks and totals (staff). */
export const GET = route<Params>(async ({ deps, actor, params }) => getGradebook(deps, actor, params.id), {
  roles: ["TEACHER", "ADMIN"],
});
