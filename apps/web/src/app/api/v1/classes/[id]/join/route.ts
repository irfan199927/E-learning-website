import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { getJoinUrl } from "@/server/services/classes";

/**
 * GET /api/v1/classes/:id/join — time-gated redirect to Google Meet.
 * Meet links are never sent to students' browsers ahead of time.
 */
export const GET = route<{ id: string }>(async ({ deps, actor, params }) =>
  NextResponse.redirect(await getJoinUrl(deps, actor, params.id), { status: 303 }),
);
