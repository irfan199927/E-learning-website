import { z } from "zod";

/** Worker environment. Validated at boot: a misconfigured worker must crash, not limp. See docs/environment.md */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  /** Leave both empty to run without Google (e.g. a LAN-only UAT): no Google sign-in, no Meet scheduling. */
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_WORKSPACE_DOMAIN: z
    .string()
    .optional()
    .transform((v) => v || undefined), // empty = unset
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
  ATTENDANCE_PRESENT_RATIO: z.coerce.number().min(0).max(1).default(0.5),
  WORKER_HEALTH_PORT: z.coerce.number().int().default(8080),
  TRANSCODE_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  FFPROBE_PATH: z.string().default("ffprobe"),
});

export type WorkerEnv = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid worker environment:\n${problems}\nSee docs/environment.md`);
  }
  return parsed.data;
}
