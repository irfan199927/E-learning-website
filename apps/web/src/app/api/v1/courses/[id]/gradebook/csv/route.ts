import { route } from "@/lib/http";
import { gradebookCsv } from "@/server/services/gradebook";

type Params = { id: string };

/** GET /api/v1/courses/:id/gradebook/csv — the gradebook as a spreadsheet download (staff; audited). */
export const GET = route<Params>(
  async ({ deps, actor, params }) => {
    const { filename, csv } = await gradebookCsv(deps, actor, params.id);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  },
  { roles: ["TEACHER", "ADMIN"] },
);
