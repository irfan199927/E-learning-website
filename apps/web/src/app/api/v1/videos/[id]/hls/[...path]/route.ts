import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { getHlsFile } from "@/server/services/videos";

/**
 * GET /api/v1/videos/:id/hls/<path> — gated HLS delivery (ADR-0005).
 * Playlists are returned rewritten; anything else redirects to a short-lived presigned URL.
 */
export const GET = route<{ id: string; path: string[] }>(
  async ({ deps, actor, params }) => {
    const file = await getHlsFile(deps, actor, params.id, params.path);
    if (file.kind === "redirect") return NextResponse.redirect(file.url, { status: 302 });
    return new Response(file.body, {
      headers: { "content-type": "application/vnd.apple.mpegurl", "cache-control": "private, no-store" },
    });
  },
  { rateLimit: { bucket: "hls", limit: 2000, windowSec: 600 } },
);
