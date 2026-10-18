/**
 * Worker process. One process runs every queue consumer + the schedulers.
 * Scale by running more replicas: BullMQ distributes jobs; schedulers are deduplicated by id.
 *
 * Lifecycle: validate env → connect → start consumers → register schedules → serve /healthz.
 * SIGTERM: stop taking jobs, let in-flight jobs finish (up to 60 s), close connections, exit 0.
 */
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { parseKeyring } from "@elearner/core";
import { createDb } from "@elearner/db";
import { createTeacherGoogle, PrismaCredentialStore } from "@elearner/google";
import { createSmtpMailer } from "@elearner/notify";
import {
  calendarSyncJob,
  createRedis,
  Jobs,
  maintenanceJob,
  QUEUE,
  recordingSyncJob,
  reminderJob,
  transcodeJob,
} from "@elearner/queue";
import { Storage } from "@elearner/storage";
import { Worker, type Job, type Processor } from "bullmq";
import pino from "pino";
import type { z } from "zod";
import type { JobContext } from "./context";
import { loadEnv } from "./env";
import { syncCalendar } from "./jobs/calendar-sync";
import { runMaintenance } from "./jobs/maintenance";
import { syncRecording } from "./jobs/recording-sync";
import { sendReminder } from "./jobs/reminder";
import { markTranscodeFailed, transcodeVideo } from "./jobs/transcode";

const env = loadEnv();
const log = pino({
  level: env.LOG_LEVEL,
  base: { service: "worker" },
  // Same safety net as the web logger: never write tokens or credentials, even inside error objects.
  redact: {
    paths: [
      "*.password",
      "*.token",
      "*.refreshToken",
      "*.accessToken",
      "*.authorization",
      "*.headers.authorization",
    ],
    censor: "[redacted]",
  },
});
const db = createDb(env.DATABASE_URL, { poolMax: 5 });
const redis = createRedis(env.REDIS_URL);
const jobs = new Jobs(redis);
const credentials = new PrismaCredentialStore(
  db,
  parseKeyring(env.TOKEN_ENC_KEYS, env.TOKEN_ENC_ACTIVE_KEY_ID),
);
const googleCfg = {
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: `${env.APP_URL}/api/v1/google/callback`,
  workspaceDomain: env.GOOGLE_WORKSPACE_DOMAIN,
};

const ctx: JobContext = {
  db,
  storage: new Storage({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  }),
  jobs,
  mailer: createSmtpMailer(env.SMTP_URL, env.MAIL_FROM),
  googleFor: (userId) => createTeacherGoogle(googleCfg, credentials, userId),
  now: () => new Date(),
  log,
  config: {
    appUrl: env.APP_URL,
    presentRatio: env.ATTENDANCE_PRESENT_RATIO,
    ffmpegPath: env.FFMPEG_PATH,
    ffprobePath: env.FFPROBE_PATH,
    tmpDir: tmpdir(),
  },
};

/** Validate the payload against the shared contract, give the job a child logger, time it. */
function processor<S extends z.ZodTypeAny>(
  schema: S,
  fn: (c: JobContext, data: z.infer<S>) => Promise<unknown>,
): Processor {
  return async (job: Job) => {
    const jobLog = log.child({ queue: job.queueName, jobId: job.id, attempt: job.attemptsMade + 1 });
    const started = Date.now();
    const result = await fn({ ...ctx, log: jobLog }, schema.parse(job.data));
    jobLog.info({ ms: Date.now() - started, result }, "job done");
    return result;
  };
}

const connection = redis;
const workers = [
  new Worker(QUEUE.reminders, processor(reminderJob, sendReminder), { connection, concurrency: 10 }),
  new Worker(QUEUE.recordingSync, processor(recordingSyncJob, syncRecording), {
    connection,
    concurrency: 2,
    limiter: { max: 10, duration: 1000 }, // stay well inside Google API quotas
  }),
  new Worker(
    QUEUE.transcode,
    processor(transcodeJob, (c, d) => transcodeVideo(c, d)),
    {
      connection,
      concurrency: env.TRANSCODE_CONCURRENCY,
      lockDuration: 5 * 60_000, // long-running; lock is renewed automatically while alive
    },
  ),
  new Worker(QUEUE.calendarSync, processor(calendarSyncJob, syncCalendar), { connection, concurrency: 4 }),
  new Worker(QUEUE.maintenance, processor(maintenanceJob, runMaintenance), { connection, concurrency: 1 }),
];

for (const w of workers) {
  w.on("failed", (job, err) => {
    const final = job ? job.attemptsMade >= (job.opts.attempts ?? 1) : true;
    log[final ? "error" : "warn"]({ queue: w.name, jobId: job?.id, err, final }, "job failed");
    if (final && w.name === QUEUE.transcode && job)
      void markTranscodeFailed(ctx, String(job.data.videoId), err.message);
  });
  w.on("error", (err) => log.error({ err, queue: w.name }, "worker error"));
}

async function registerSchedules() {
  const tz = "Asia/Kolkata";
  await jobs.maintenance.upsertJobScheduler(
    "sweep-ended-classes",
    { every: 5 * 60_000 },
    { name: "sweep", data: { task: "sweep-ended-classes" } },
  );
  await jobs.maintenance.upsertJobScheduler(
    "abort-stale-uploads",
    { every: 60 * 60_000 },
    { name: "uploads", data: { task: "abort-stale-uploads" } },
  );
  await jobs.maintenance.upsertJobScheduler(
    "reconcile-reminders",
    { every: 15 * 60_000 },
    { name: "reminders", data: { task: "reconcile-reminders" } },
  );
  await jobs.maintenance.upsertJobScheduler(
    "delete-transcoded-raw",
    { pattern: "30 3 * * *", tz },
    { name: "raw", data: { task: "delete-transcoded-raw" } },
  );
  await jobs.maintenance.upsertJobScheduler(
    "renew-watch-channels",
    { pattern: "15 3 * * *", tz },
    { name: "watch", data: { task: "renew-watch-channels" } },
  );
  await jobs.maintenance.upsertJobScheduler(
    "sweep-orphan-uploads",
    { pattern: "5 4 * * *", tz },
    { name: "orphans", data: { task: "sweep-orphan-uploads" } },
  );
  await jobs.maintenance.upsertJobScheduler(
    "prune-notifications",
    { pattern: "55 3 * * *", tz },
    { name: "notifications", data: { task: "prune-notifications" } },
  );
  await jobs.maintenance.upsertJobScheduler(
    "purge-deleted-users",
    { pattern: "45 2 * * *", tz },
    { name: "purge", data: { task: "purge-deleted-users" } },
  );
  // Early evening, after the school day: one email of the day's unread notifications.
  await jobs.maintenance.upsertJobScheduler(
    "send-notification-digest",
    { pattern: "0 18 * * *", tz },
    { name: "digest", data: { task: "send-notification-digest" } },
  );
}

const health = createServer(async (req, res) => {
  if (req.url !== "/healthz") return res.writeHead(404).end();
  try {
    await Promise.all([redis.ping(), db.$queryRaw`SELECT 1`]);
    res
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ status: "ok", workers: workers.length }));
  } catch (err) {
    log.warn({ err }, "health check failed");
    res.writeHead(503).end(JSON.stringify({ status: "fail" }));
  }
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, "shutting down: draining in-flight jobs");
  const force = setTimeout(() => {
    log.error("forced exit after 60s");
    process.exit(1);
  }, 60_000);
  force.unref();
  await Promise.allSettled(workers.map((w) => w.close()));
  await Promise.allSettled([jobs.close(), db.$disconnect()]);
  health.close();
  await redis.quit().catch(() => undefined);
  log.info("bye");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (err) => log.error({ err }, "unhandled rejection"));

await registerSchedules();
health.listen(env.WORKER_HEALTH_PORT, () =>
  log.info({ port: env.WORKER_HEALTH_PORT, queues: workers.map((w) => w.name) }, "worker ready"),
);
