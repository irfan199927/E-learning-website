import { dateOfBirthSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { setDateOfBirth } from "@/server/services/consent";

/** POST /api/v1/me/date-of-birth — a student gives their date of birth (once). Returns their consent state. */
export const POST = route(
  async ({ req, deps, actor }) => setDateOfBirth(deps, actor, await body(req, dateOfBirthSchema)),
  { roles: ["STUDENT"], rateLimit: { bucket: "dob", limit: 10, windowSec: 3600 } },
);
