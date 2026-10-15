import { checkReadiness } from "@/server/services/health";

/** Readiness: config valid, Postgres and Redis reachable. Used by the load balancer and deploy checks. */
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkReadiness();
  return Response.json(result, { status: result.status === "ok" ? 200 : 503 });
}
