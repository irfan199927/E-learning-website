import { decideJoinRequestSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { decideJoinRequest } from "@/server/services/join-requests";

type Params = { id: string };

/** PATCH /api/v1/join-requests/:id — approve (enrols the student) or decline. */
export const PATCH = route<Params>(
  async ({ req, deps, actor, params }) =>
    decideJoinRequest(deps, actor, params.id, await body(req, decideJoinRequestSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);
