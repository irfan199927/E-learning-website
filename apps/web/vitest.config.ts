import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // `server-only` throws outside the React server runtime; it's a no-op for tests.
  "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        // Same JSX runtime as Next.js, so component tests don't need React in scope.
        esbuild: { jsx: "automatic" },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
          environment: "node",
        },
      },
      {
        // Needs a real Postgres (DATABASE_URL). CI provides one as a service container.
        resolve: { alias },
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          environment: "node",
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 20_000,
        },
      },
    ],
  },
});
