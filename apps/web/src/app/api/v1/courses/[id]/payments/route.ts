import { submitPaymentSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { getCoursePayment, submitPayment } from "@/server/services/payments";

type Params = { id: string };

/** GET /api/v1/courses/:id/payments — the price, where to pay, and the student's latest payment report. */
export const GET = route<Params>(
  async ({ deps, actor, params }) => getCoursePayment(deps, actor, params.id),
  {
    roles: ["STUDENT"],
  },
);

/** POST /api/v1/courses/:id/payments — report a UPI payment ({ reference, note?, proof? }) for an admin to check. */
export const POST = route<Params>(
  async ({ req, deps, actor, params }) =>
    submitPayment(deps, actor, params.id, await body(req, submitPaymentSchema)),
  { roles: ["STUDENT"], rateLimit: { bucket: "payment-submit", limit: 10, windowSec: 3600 } },
);
