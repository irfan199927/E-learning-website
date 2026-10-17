/**
 * Everything a job needs, as interfaces (same pattern as the web app's Deps).
 * Jobs are plain functions `(ctx, payload) => Promise<result>` — easy to test with fakes.
 */
import type { Db } from "@elearner/db";
import type { TeacherGoogle } from "@elearner/google";
import type { Mailer } from "@elearner/notify";
import type { Jobs } from "@elearner/queue";
import type { Storage } from "@elearner/storage";
import type { Logger } from "pino";

export type WorkerJobs = Pick<
  Jobs,
  "scheduleReminders" | "cancelReminders" | "enqueueTranscode" | "enqueueRecordingSync"
>;
export type WorkerStorage = Pick<
  Storage,
  "putStream" | "presignGet" | "abortMultipart" | "deleteObject" | "deletePrefix" | "listObjects"
>;

export interface WorkerConfig {
  appUrl: string;
  presentRatio: number;
  ffmpegPath: string;
  ffprobePath: string;
  tmpDir: string;
}

export interface JobContext {
  db: Db;
  storage: WorkerStorage;
  jobs: WorkerJobs;
  mailer: Mailer;
  googleFor(userId: string): Promise<TeacherGoogle>;
  now(): Date;
  log: Logger;
  config: WorkerConfig;
}
