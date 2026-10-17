import { initPaymentImageSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { initProofUpload } from "@/server/services/payments";

/** POST /api/v1/payments/proofs — a presigned PUT URL for a payment screenshot (students). */
export const POST = route(
  async ({ req, deps, actor }) => initProofUpload(deps, actor, await body(req, initPaymentImageSchema)),
  { roles: ["STUDENT"], rateLimit: { bucket: "payment-proof", limit: 20, windowSec: 3600 } },
);
