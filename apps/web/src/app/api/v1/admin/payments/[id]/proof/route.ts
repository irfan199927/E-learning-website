import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { proofUrl } from "@/server/services/payments";

type Params = { id: string };

/** GET /api/v1/admin/payments/:id/proof — redirect to the payment screenshot (admin). */
export const GET = route<Params>(
  async ({ deps, actor, params }) =>
    NextResponse.redirect(await proofUrl(deps, actor, params.id), { status: 302 }),
  { roles: ["ADMIN"] },
);
