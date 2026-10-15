import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Local dev keeps one .env at the repo root; real environments set variables directly.
const rootEnv = new URL("../../.env", import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Static security headers. The Content-Security-Policy is per-request (nonce) and set in src/middleware.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const config: NextConfig = {
  output: "standalone",
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
  serverExternalPackages: ["bullmq", "ioredis", "googleapis", "pg", "nodemailer", "pino"],
  typedRoutes: false,
  eslint: { ignoreDuringBuilds: true }, // lint runs in CI as its own step
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
