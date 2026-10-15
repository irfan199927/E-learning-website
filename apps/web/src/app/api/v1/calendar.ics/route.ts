import { listClassesQuerySchema } from "@elearner/core";
import { query, route } from "@/lib/http";
import { exportIcs } from "@/server/services/classes";

/** GET /api/v1/calendar.ics?from=&to= — download visible classes as iCalendar. */
export const GET = route(async ({ req, deps, actor }) => {
  const ics = await exportIcs(deps, actor, query(req, listClassesQuerySchema));
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="e-learner-classes.ics"',
      "cache-control": "private, no-store",
    },
  });
});
