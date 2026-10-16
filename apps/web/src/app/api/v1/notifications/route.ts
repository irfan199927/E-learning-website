import { route } from "@/lib/http";
import { listNotifications } from "@/server/services/notifications";

/** GET /api/v1/notifications?before=ISO — your notifications, newest first, 50 per page, plus the unread count. */
export const GET = route(async ({ req, deps, actor }) => {
  const before = req.nextUrl.searchParams.get("before");
  const date = before ? new Date(before) : undefined;
  return listNotifications(deps, actor, { before: date && !Number.isNaN(date.getTime()) ? date : undefined });
});
