import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { qrUrl } from "@/server/services/payments";

/** GET /api/v1/payment-qr?v= — redirect to the school's UPI QR code image (anyone signed in). */
export const GET = route(async ({ deps }) => {
  const res = NextResponse.redirect(await qrUrl(deps), { status: 302 });
  res.headers.set("cache-control", "private, max-age=600");
  return res;
});
