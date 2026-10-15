import { completeUploadSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { abortUpload, completeUpload } from "@/server/services/videos";

type Params = { id: string };

/** POST /api/v1/videos/uploads/:id/complete — assemble parts and queue transcoding. */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) =>
    completeUpload(deps, actor, params.id, await body(req, completeUploadSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);

/** DELETE /api/v1/videos/uploads/:id/complete — abort an in-progress upload. */
export const DELETE = route<Params>(
  async ({ deps, actor, params }) => {
    await abortUpload(deps, actor, params.id);
    return new Response(null, { status: 204 });
  },
  { roles: ["TEACHER", "ADMIN"] },
);
