import { initAttachmentSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { initAttachmentUpload } from "@/server/services/course-content";

type Params = { id: string };

/**
 * POST /api/v1/lessons/:id/attachments/uploads — get a presigned URL to PUT one file to storage
 * (with the same Content-Type), then call POST /lessons/:id/attachments.
 */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) =>
    initAttachmentUpload(deps, actor, params.id, await body(req, initAttachmentSchema)),
  { roles: ["TEACHER", "ADMIN"], rateLimit: { bucket: "attachment-upload", limit: 120, windowSec: 3600 } },
);
