import { initSubmissionFileSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { initSubmissionFile } from "@/server/services/assignments";

type Params = { id: string };

/** POST /api/v1/assignments/:id/files — presigned URL to PUT one answer file (send the same Content-Type). */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) =>
    initSubmissionFile(deps, actor, params.id, await body(req, initSubmissionFileSchema)),
  { roles: ["STUDENT"], rateLimit: { bucket: "submission-upload", limit: 60, windowSec: 3600 } },
);
