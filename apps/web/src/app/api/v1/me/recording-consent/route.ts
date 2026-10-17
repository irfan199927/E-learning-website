import { agreeRecordingSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import {
  agreeToRecording,
  getRecordingConsent,
  withdrawRecordingConsent,
} from "@/server/services/recording-consent";

/** GET /api/v1/me/recording-consent — whether the student has agreed to the current recording notice. */
export const GET = route(async ({ deps, actor }) => getRecordingConsent(deps, actor), { roles: ["STUDENT"] });

/** POST /api/v1/me/recording-consent — agree to the notice version shown ({ version }). */
export const POST = route(
  async ({ req, deps, actor }) => agreeToRecording(deps, actor, await body(req, agreeRecordingSchema)),
  { roles: ["STUDENT"] },
);

/** DELETE /api/v1/me/recording-consent — withdraw. Joining live classes is refused until they agree again. */
export const DELETE = route(async ({ deps, actor }) => withdrawRecordingConsent(deps, actor), {
  roles: ["STUDENT"],
});
