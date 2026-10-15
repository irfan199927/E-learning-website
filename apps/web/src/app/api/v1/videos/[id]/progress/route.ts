import { videoProgressSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { saveProgress } from "@/server/services/videos";

/** PUT /api/v1/videos/:id/progress — resume position + watched time (beacon every ~15 s). */
export const PUT = route<{ id: string }>(
  async ({ req, deps, actor, params }) =>
    saveProgress(deps, actor, params.id, await body(req, videoProgressSchema)),
  { rateLimit: { bucket: "progress", limit: 240, windowSec: 3600 } },
);
