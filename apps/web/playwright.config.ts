import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke suite. Runs against a production build (`next start`) with a seeded database.
 * CI: see .github/workflows/ci.yml (job "e2e"). Locally: `pnpm db:seed && pnpm test:e2e`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    // Better Auth rejects sign-ins whose Origin isn't APP_URL, so point it at the e2e port.
    env: { APP_URL: `http://localhost:${PORT}`, AUTH_SIGNIN_LIMIT_PER_MIN: "100" },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
