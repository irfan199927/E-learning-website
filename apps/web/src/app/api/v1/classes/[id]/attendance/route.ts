import { markAttendanceSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { getAttendanceSheet, markAttendance } from "@/server/services/attendance";

type Params = { id: string };

/** GET /api/v1/classes/:id/attendance — the class's students and their marks (host, course teacher, admin). */
export const GET = route<Params>(
  async ({ deps, actor, params }) => getAttendanceSheet(deps, actor, params.id),
  {
    roles: ["TEACHER", "ADMIN"],
  },
);

/** PUT /api/v1/classes/:id/attendance — save marks ({ marks: [{ userId, present }] }) once the class has started. */
export const PUT = route<Params>(
  async ({ req, deps, actor, params }) =>
    markAttendance(deps, actor, params.id, await body(req, markAttendanceSchema)),
  { roles: ["TEACHER", "ADMIN"] },
);
