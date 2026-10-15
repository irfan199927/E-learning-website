/**
 * Server environment, validated once and cached. Import `env()` only from server code.
 * Parsing is lazy so `next build` doesn't need production secrets; the first request
 * (or the readiness probe) fails loudly if anything is missing.
 * Reference: docs/environment.md
 */
import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_WORKSPACE_DOMAIN: z.string().min(3).optional(),
  TOKEN_ENC_KEYS: z.string().min(1),
  TOKEN_ENC_ACTIVE_KEY_ID: z.string().min(1),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_URL: z.string().min(1),
  MAIL_FROM: z.string().min(3),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(4 * 1024 ** 3),
  JOIN_OPENS_MINUTES_BEFORE: z.coerce.number().int().min(0).max(60).default(10),
  /** Sign-in attempts per minute per IP. Keep the default in production; raised only for e2e runs. */
  AUTH_SIGNIN_LIMIT_PER_MIN: z.coerce.number().int().min(1).default(5),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Invalid environment configuration:\n${problems}\nSee docs/environment.md`);
    }
    cached = parsed.data;
  }
  return cached;
}
