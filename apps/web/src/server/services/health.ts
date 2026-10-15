import "server-only";
import { env } from "@/env";
import { container } from "../container";

type Check = "ok" | "fail";

export async function checkReadiness(): Promise<{
  status: Check;
  checks: Record<string, Check>;
  error?: string;
}> {
  try {
    env();
  } catch (e) {
    return { status: "fail", checks: { config: "fail" }, error: (e as Error).message.split("\n")[0] };
  }
  const { deps, redis } = container();
  const timeout = <T>(p: Promise<T>) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 2000))]);
  const [db, cache] = await Promise.allSettled([timeout(deps.db.$queryRaw`SELECT 1`), timeout(redis.ping())]);
  const checks = {
    config: "ok",
    database: db.status === "fulfilled" ? "ok" : "fail",
    redis: cache.status === "fulfilled" ? "ok" : "fail",
  } as const;
  return { status: Object.values(checks).every((c) => c === "ok") ? "ok" : "fail", checks };
}
