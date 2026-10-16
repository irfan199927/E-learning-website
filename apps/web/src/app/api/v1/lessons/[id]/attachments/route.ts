import { completeAttachmentSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { completeAttachment } from "@/server/services/course-content";

type Params = { id: string };

/** POST /api/v1/lessons/:id/attachments — record a file uploaded with the URL from .../uploads. */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) =>
    completeAttachment(deps, actor, params.id, await body(req, completeAttachmentSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);
