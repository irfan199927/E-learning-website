import { route } from "@/lib/http";
import { unreadCount } from "@/server/services/notifications";

/** GET /api/v1/notifications/unread-count — the bell's badge ({ unread }); polled by the top bar. */
export const GET = route(async ({ deps, actor }) => ({ unread: await unreadCount(deps, actor) }), {
  rateLimit: { bucket: "unread-count", limit: 120, windowSec: 60 },
});
