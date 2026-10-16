import { route } from "@/lib/http";
import { getChildProgress } from "@/server/services/parents";

type Params = { id: string };

/** GET /api/v1/children/:id?month=YYYY-MM — one child's progress, courses and recent class attendance. */
export const GET = route<Params>(
  async ({ req, deps, actor, params }) =>
    getChildProgress(deps, actor, params.id, { month: req.nextUrl.searchParams.get("month") ?? undefined }),
  { roles: ["PARENT"] },
);
