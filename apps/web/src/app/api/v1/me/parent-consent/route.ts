import { parentConsentRequestSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { requestParentConsent } from "@/server/services/consent";

/** POST /api/v1/me/parent-consent — a minor sends a parent the consent link. */
export const POST = route(
  async ({ req, deps, actor }) =>
    requestParentConsent(deps, actor, await body(req, parentConsentRequestSchema)),
  { roles: ["STUDENT"], rateLimit: { bucket: "parent-consent", limit: 5, windowSec: 3600 } },
);
