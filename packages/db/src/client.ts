import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export type Db = PrismaClient;

/** Create a Prisma client backed by node-postgres. Prefer the shared `getDb()` singleton in app code. */
export function createDb(connectionString: string, opts: { poolMax?: number } = {}): PrismaClient {
  const adapter = new PrismaPg({ connectionString, max: opts.poolMax ?? 10 });
  return new PrismaClient({ adapter });
}

// One client per process. Next.js dev hot-reload re-evaluates modules, so cache on globalThis.
const globalForDb = globalThis as unknown as { __elearnerDb?: PrismaClient };

export function getDb(): PrismaClient {
  if (!globalForDb.__elearnerDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__elearnerDb = createDb(url);
  }
  return globalForDb.__elearnerDb;
}
