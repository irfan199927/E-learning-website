/** Liveness: the process is up. Never touches dependencies (a DB blip must not restart pods). */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", version: process.env.APP_VERSION ?? "dev" });
}
