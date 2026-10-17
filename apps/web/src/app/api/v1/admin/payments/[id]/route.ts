import { decidePaymentSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { decidePayment } from "@/server/services/payments";

type Params = { id: string };

/** PATCH /api/v1/admin/payments/:id — approve (enrols the student) or reject with a reason. */
export const PATCH = route<Params>(
  async ({ req, deps, actor, params }) =>
    decidePayment(deps, actor, params.id, await body(req, decidePaymentSchema)),
  { roles: ["ADMIN"] },
);
