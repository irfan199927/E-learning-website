import { completeQrSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { completeQrUpload, removeQr } from "@/server/services/payments";

/** PUT /api/v1/admin/payment-settings/qr — record an uploaded QR code image ({ qrId, mimeType }). */
export const PUT = route(
  async ({ req, deps, actor }) => {
    await completeQrUpload(deps, actor, await body(req, completeQrSchema));
    return new Response(null, { status: 204 });
  },
  { roles: ["ADMIN"] },
);

/** DELETE /api/v1/admin/payment-settings/qr — remove the QR code image. */
export const DELETE = route(
  async ({ deps, actor }) => {
    await removeQr(deps, actor);
    return new Response(null, { status: 204 });
  },
  { roles: ["ADMIN"] },
);
