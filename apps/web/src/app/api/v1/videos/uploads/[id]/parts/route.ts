import { presignPartsSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { presignParts } from "@/server/services/videos";

/** POST /api/v1/videos/uploads/:id/parts — presigned PUT URLs for up to 100 parts (valid 1 h). */
export const POST = route<{ id: string }>(
  async ({ req, deps, actor, params }) =>
    presignParts(deps, actor, params.id, (await body(req, presignPartsSchema)).partNumbers),
  { roles: ["TEACHER", "ADMIN"], rateLimit: { bucket: "upload-parts", limit: 600, windowSec: 3600 } },
);
