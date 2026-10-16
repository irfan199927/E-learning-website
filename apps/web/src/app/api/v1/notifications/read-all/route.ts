import { route } from "@/lib/http";
import { markAllRead } from "@/server/services/notifications";

/** POST /api/v1/notifications/read-all — mark everything read. */
export const POST = route(async ({ deps, actor }) => markAllRead(deps, actor));
