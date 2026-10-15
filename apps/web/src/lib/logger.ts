import "server-only";
import pino from "pino";

/**
 * Structured JSON logs (one line per event) — ship stdout to your log platform.
 * Never log tokens, passwords, or student PII beyond ids. `redact` is a safety net, not a licence.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "web" },
  redact: {
    paths: [
      "*.password",
      "*.token",
      "*.refreshToken",
      "*.accessToken",
      "*.authorization",
      "*.cookie",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;
