import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Local dev keeps one .env at the repo root; real environments set variables directly.
const rootEnv = new URL("../../.env", import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Static security headers. The Content-Security-Policy is per-request (nonce) and set in src/middleware.ts, as are
// HSTS and COOP: they only apply over HTTPS, and the same image also runs on a plain-HTTP LAN UAT.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
];

/**
 * STATIC_SITE=1 builds only the public landing page as plain files (apps/web/out) for a static host:
 * only `*.site.tsx` routes exist (page.site.tsx / layout.site.tsx), so the app, API and middleware are
 * left out. See docs/deployment.md "Static landing site".
 */
const staticSite = process.env.STATIC_SITE === "1";

const config: NextConfig = {
  ...(staticSite
    ? {
        output: "export",
        pageExtensions: ["site.tsx", "site.ts"],
        trailingSlash: true,
        images: { unoptimized: true },
        distDir: "out", // the export lands here; Next removes its build internals afterwards
      }
    : // Docker images run the standalone server; Vercel (VERCEL=1 at build) uses its own Next.js output.
      process.env.VERCEL
      ? {}
      : { output: "standalone" }),
  poweredByHeader: false,
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: [
    "@elearner/core",
    "@elearner/db",
    "@elearner/google",
    "@elearner/notify",
    "@elearner/queue",
    "@elearner/storage",
  ],
  // Node-only libraries with native/dynamic requires stay external to the server bundle.
  serverExternalPackages: [
    "bullmq",
    "ioredis",
    "@googleapis/calendar",
    "@googleapis/drive",
    "@googleapis/meet",
    "google-auth-library",
    "pg",
    "nodemailer",
    "pino",
  ],
  typedRoutes: false,
  eslint: { ignoreDuringBuilds: true }, // lint runs in CI as its own step
  // Static hosts set headers themselves (vercel.json); `headers()` is unsupported with output: export.
  ...(staticSite ? {} : { headers: async () => [{ source: "/:path*", headers: securityHeaders }] }),
};

export default config;
