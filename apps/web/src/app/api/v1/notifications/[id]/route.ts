import { route } from "@/lib/http";
import { markRead } from "@/server/services/notifications";

type Params = { id: string };

/** PATCH /api/v1/notifications/:id — mark one read; returns its link (a same-site path) to open. */
export const PATCH = route<Params>(async ({ deps, actor, params }) => markRead(deps, actor, params.id));
