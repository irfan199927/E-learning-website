import { paymentsExportQuerySchema } from "@elearner/core";
import { query, route } from "@/lib/http";
import { paymentsCsv } from "@/server/services/payments";

/**
 * GET /api/v1/admin/payments/csv?from=YYYY-MM-DD&to=YYYY-MM-DD&status=ALL|PENDING|APPROVED|REJECTED —
 * reported payments in a date range as a spreadsheet download (admin; audited).
 */
export const GET = route(
  async ({ req, deps, actor }) => {
    const { filename, csv } = await paymentsCsv(deps, actor, query(req, paymentsExportQuerySchema));
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  },
  { roles: ["ADMIN"] },
);
