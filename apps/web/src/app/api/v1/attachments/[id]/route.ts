import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { attachmentDownloadUrl, deleteAttachment } from "@/server/services/course-content";

type Params = { id: string };

/** GET /api/v1/attachments/:id — download (redirects to a 5-minute presigned URL after the access check). */
export const GET = route<Params>(
  async ({ deps, actor, params }) =>
    NextResponse.redirect(await attachmentDownloadUrl(deps, actor, params.id), { status: 302 }),
  { rateLimit: { bucket: "attachment-download", limit: 300, windowSec: 600 } },
);

/** DELETE /api/v1/attachments/:id — remove a file from its lesson. */
export const DELETE = route<Params>(
  async ({ deps, actor, params }) => {
    await deleteAttachment(deps, actor, params.id);
    return new Response(null, { status: 204 });
  },
  { roles: ["TEACHER", "ADMIN"] },
);
