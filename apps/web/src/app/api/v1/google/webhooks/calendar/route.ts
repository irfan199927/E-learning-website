import { publicRoute } from "@/lib/http";
import { handleCalendarPush } from "@/server/services/google-connect";

/**
 * POST /api/v1/google/webhooks/calendar — Google Calendar push notifications.
 * Authenticated by the per-channel secret token (X-Goog-Channel-Token), not by session.
 * Always answers 200 quickly; the actual sync runs in the worker.
 */
export const POST = publicRoute(
  async ({ req, deps }) => {
    await handleCalendarPush(deps, {
      channelId: req.headers.get("x-goog-channel-id"),
      token: req.headers.get("x-goog-channel-token"),
      resourceState: req.headers.get("x-goog-resource-state"),
    });
    return new Response(null, { status: 200 });
  },
  { rateLimit: { bucket: "gcal-push", limit: 600, windowSec: 60 } },
);
