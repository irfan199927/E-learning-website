import { paymentSettingsSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { getPaymentSettings, updatePaymentSettings } from "@/server/services/payments";

/** GET /api/v1/admin/payment-settings — the school's UPI details (admin). */
export const GET = route(async ({ deps }) => getPaymentSettings(deps), { roles: ["ADMIN"] });

/** PUT /api/v1/admin/payment-settings — set the UPI ID, payee name, phone and instructions students pay to. */
export const PUT = route(
  async ({ req, deps, actor }) => updatePaymentSettings(deps, actor, await body(req, paymentSettingsSchema)),
  { roles: ["ADMIN"] },
);
