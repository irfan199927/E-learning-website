import { initPaymentImageSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { initQrUpload } from "@/server/services/payments";

/** POST /api/v1/admin/payment-settings/qr/uploads — a presigned PUT URL for a QR code image. */
export const POST = route(
  async ({ req, deps, actor }) => initQrUpload(deps, actor, await body(req, initPaymentImageSchema)),
  { roles: ["ADMIN"] },
);
