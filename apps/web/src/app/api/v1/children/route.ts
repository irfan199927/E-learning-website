import { route } from "@/lib/http";
import { listChildren } from "@/server/services/parents";

/** GET /api/v1/children — a parent's linked children with headline progress. */
export const GET = route(async ({ deps, actor }) => listChildren(deps, actor), { roles: ["PARENT"] });
