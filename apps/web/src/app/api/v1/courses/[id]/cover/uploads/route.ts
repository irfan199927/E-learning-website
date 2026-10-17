import { initCoverSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { initCoverUpload } from "@/server/services/course-cover";

type Params = { id: string };

/** POST /api/v1/courses/:id/cover/uploads — a presigned PUT URL for a new cover image ({ mimeType, sizeBytes }). */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) =>
    initCoverUpload(deps, actor, params.id, await body(req, initCoverSchema)),
  { roles: ["TEACHER", "ADMIN"], rateLimit: { bucket: "cover-upload", limit: 30, windowSec: 3600 } },
);
