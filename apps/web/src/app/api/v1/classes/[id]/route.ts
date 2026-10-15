import { rescheduleClassSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { cancelClass, rescheduleClass } from "@/server/services/classes";

type Params = { id: string };

/** PATCH /api/v1/classes/:id — move one class (this occurrence only). Updates Google Calendar + reminders. */
export const PATCH = route<Params>(
  async ({ req, deps, actor, params }) =>
    rescheduleClass(deps, actor, params.id, await body(req, rescheduleClassSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);

/** DELETE /api/v1/classes/:id — cancel one class. Attendees get a Google cancellation email. */
export const DELETE = route<Params>(
  async ({ deps, actor, params }) => {
    await cancelClass(deps, actor, params.id);
    return new Response(null, { status: 204 });
  },
  { roles: ["TEACHER", "ADMIN"] },
);
