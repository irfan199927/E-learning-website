import { completeCoverSchema } from "@elearner/core";
import { NextResponse } from "next/server";
import { body, route } from "@/lib/http";
import { completeCoverUpload, coverUrl, removeCover } from "@/server/services/course-cover";

type Params = { id: string };

/**
 * GET /api/v1/courses/:id/cover?v= — redirect to a signed URL for the cover image. The `v` (cover version)
 * changes with every upload, so the browser may cache the redirect briefly.
 */
export const GET = route<Params>(async ({ deps, actor, params }) => {
  const res = NextResponse.redirect(await coverUrl(deps, actor, params.id), { status: 302 });
  res.headers.set("cache-control", "private, max-age=600");
  return res;
});

/** PUT /api/v1/courses/:id/cover — record an uploaded cover ({ coverId, mimeType }); replaces the old one. */
export const PUT = route<Params>(
  async ({ req, deps, actor, params }) =>
    completeCoverUpload(deps, actor, params.id, await body(req, completeCoverSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);

/** DELETE /api/v1/courses/:id/cover — back to the generated tile. */
export const DELETE = route<Params>(
  async ({ deps, actor, params }) => {
    await removeCover(deps, actor, params.id);
    return new Response(null, { status: 204 });
  },
  { roles: ["TEACHER", "ADMIN"] },
);
