import { defineConfig } from "prisma/config";

// `prisma generate` must work without a database (CI, Docker builds), so DATABASE_URL is
// optional here. Commands that need a connection (migrate, studio, seed) fail clearly without it.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
