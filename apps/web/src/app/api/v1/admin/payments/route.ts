import { listPaymentsQuerySchema } from "@elearner/core";
import { query, route } from "@/lib/http";
import { listPayments } from "@/server/services/payments";

/** GET /api/v1/admin/payments?status=PENDING|APPROVED|REJECTED — reported UPI payments (admin). */
export const GET = route(
  async ({ req, deps, actor }) => listPayments(deps, actor, query(req, listPaymentsQuerySchema)),
  { roles: ["ADMIN"] },
);
