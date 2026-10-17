import { publicRoute } from "@/lib/http";
import { openApiDocument } from "@/server/openapi";

/** GET /api/v1/openapi.json — the OpenAPI 3 description of this API (public: it describes, it doesn't reveal). */
export const GET = publicRoute(
  async ({ deps }) =>
    Response.json(openApiDocument(deps.config.appUrl), {
      headers: { "cache-control": "public, max-age=300" },
    }),
  { rateLimit: { bucket: "openapi", limit: 60, windowSec: 60 } },
);
