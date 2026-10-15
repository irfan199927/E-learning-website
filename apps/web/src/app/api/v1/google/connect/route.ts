import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { startConnect } from "@/server/services/google-connect";

/** GET /api/v1/google/connect?returnTo=/calendar — send a teacher to Google to grant API access. */
export const GET = route(
  async ({ req, deps, actor }) =>
    NextResponse.redirect(startConnect(deps, actor, req.nextUrl.searchParams.get("returnTo"))),
  { roles: ["TEACHER"] },
);
