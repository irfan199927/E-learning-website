import { isAppError } from "@elearner/core";
import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { completeConnect } from "@/server/services/google-connect";

/** GET /api/v1/google/callback — OAuth redirect target. Always lands the user back on a page. */
export const GET = route(
  async ({ req, deps, actor, log }) => {
    const url = req.nextUrl;
    const back = (path: string, status: string, msg?: string) => {
      const to = new URL(path, url.origin);
      to.searchParams.set("google", status);
      if (msg) to.searchParams.set("message", msg);
      return NextResponse.redirect(to, { status: 303 });
    };
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (url.searchParams.get("error") || !code || !state) return back("/calendar", "cancelled");
    try {
      return back(await completeConnect(deps, actor, code, state), "connected");
    } catch (err) {
      log.warn({ err }, "google connect failed");
      return back(
        "/calendar",
        "error",
        isAppError(err) ? err.message : "Could not connect Google. Try again.",
      );
    }
  },
  { roles: ["TEACHER"] },
);
