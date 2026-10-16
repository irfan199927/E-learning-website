import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Local dev keeps one .env at the repo root; real environments set variables directly.
const rootEnv = new URL("../../.env", import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// `prisma generate` must work without a database (CI, Docker builds), so DATABASE_URL is
// optional here. Commands that need a connection (migrate, studio, seed) fail clearly without it.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file-if-exists=../../.env prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
