import { joinRequestSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { listJoinRequests, requestToJoin } from "@/server/services/join-requests";

type Params = { id: string };

/** GET /api/v1/courses/:id/join-requests — pending requests (course teacher or admin). */
export const GET = route<Params>(({ deps, actor, params }) => listJoinRequests(deps, actor, params.id), {
  roles: ["TEACHER", "ADMIN"],
});

/** POST /api/v1/courses/:id/join-requests — a student asks to join a published course. */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) =>
    requestToJoin(deps, actor, params.id, await body(req, joinRequestSchema)),
  { roles: ["STUDENT"], rateLimit: { bucket: "join-request", limit: 30, windowSec: 3600 } },
);
