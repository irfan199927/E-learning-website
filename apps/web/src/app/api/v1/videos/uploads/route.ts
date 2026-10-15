import { initUploadSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { initUpload } from "@/server/services/videos";

/** POST /api/v1/videos/uploads — start a resumable multipart upload. Returns part size/count. */
export const POST = route(
  async ({ req, deps, actor }) => initUpload(deps, actor, await body(req, initUploadSchema)),
  { roles: ["TEACHER", "ADMIN"], rateLimit: { bucket: "upload-init", limit: 10, windowSec: 3600 } },
);
