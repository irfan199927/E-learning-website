import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { submissionFileUrl } from "@/server/services/assignments";

type Params = { id: string; index: string };

/** GET /api/v1/submissions/:id/files/:index — download (the student or the course's staff). */
export const GET = route<Params>(
  async ({ deps, actor, params }) =>
    NextResponse.redirect(await submissionFileUrl(deps, actor, params.id, Number(params.index) || 0), {
      status: 302,
    }),
  { rateLimit: { bucket: "submission-download", limit: 300, windowSec: 600 } },
);
