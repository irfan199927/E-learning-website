import { grantConsentSchema } from "@elearner/core";
import { body, publicRoute } from "@/lib/http";
import { grantConsent } from "@/server/services/consent";

type Params = { token: string };

/** POST /api/v1/consent/:token — a parent gives consent. Public: the emailed, single-use token is the credential. */
export const POST = publicRoute<Params>(
  async ({ req, deps, params }) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    return grantConsent(deps, params.token, await body(req, grantConsentSchema), ip);
  },
  { rateLimit: { bucket: "consent-grant", limit: 20, windowSec: 600 } },
);
