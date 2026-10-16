/**
 * Background jobs contract. Producers (web) and consumers (worker) share these names and
 * payload schemas, so a payload change is a compile error on both sides.
 *
 * Idempotency: every job has a deterministic jobId, so enqueuing twice is a no-op and
 * reschedules can remove exactly the jobs they invalidate.
 * NOTE: BullMQ custom job ids must not contain ":".
 */
import { reminderSchedule, type ReminderKind } from "@elearner/core";
import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { z } from "zod";

export const QUEUE = {
  reminders: "reminders",
  recordingSync: "recording-sync",
  transcode: "transcode",
  calendarSync: "calendar-sync",
  maintenance: "maintenance",
} as const;
export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

export const reminderJob = z.object({
  classSessionId: z.string(),
  kind: z.enum(["24h", "15m"]),
  /** startsAt the reminder was scheduled for; the worker drops it if the class moved. */
  startsAtMs: z.number(),
});
export type ReminderJob = z.infer<typeof reminderJob>;

export const recordingSyncJob = z.object({ classSessionId: z.string() });
export type RecordingSyncJob = z.infer<typeof recordingSyncJob>;

export const transcodeJob = z.object({ videoId: z.string() });
export type TranscodeJob = z.infer<typeof transcodeJob>;

/** Triggered by Google Calendar push notifications: pull changes for one teacher's calendar. */
export const calendarSyncJob = z.object({ userId: z.string() });
export type CalendarSyncJob = z.infer<typeof calendarSyncJob>;

export const maintenanceJob = z.object({
  task: z.enum([
    "sweep-ended-classes",
    "renew-watch-channels",
    "purge-deleted-users",
    "abort-stale-uploads",
    "reconcile-reminders",
    "delete-transcoded-raw",
  ]),
});
export type MaintenanceJob = z.infer<typeof maintenanceJob>;

export const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 5000 },
  removeOnFail: { age: 30 * 24 * 3600 },
};

/** BullMQ requires maxRetriesPerRequest=null on blocking connections. */
export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: true });
}

export const reminderJobId = (classSessionId: string, kind: ReminderKind, startsAtMs: number) =>
  `reminder_${kind}_${classSessionId}_${startsAtMs}`;

export class Jobs {
  readonly reminders: Queue<ReminderJob>;
  readonly recordingSync: Queue<RecordingSyncJob>;
  readonly transcode: Queue<TranscodeJob>;
  readonly calendarSync: Queue<CalendarSyncJob>;
  readonly maintenance: Queue<MaintenanceJob>;

  constructor(connection: ConnectionOptions) {
    const opts = { connection, defaultJobOptions: DEFAULT_JOB_OPTS };
    this.reminders = new Queue(QUEUE.reminders, opts);
    this.recordingSync = new Queue(QUEUE.recordingSync, opts);
    this.transcode = new Queue(QUEUE.transcode, {
      ...opts,
      defaultJobOptions: { ...DEFAULT_JOB_OPTS, attempts: 3 },
    });
    this.calendarSync = new Queue(QUEUE.calendarSync, opts);
    this.maintenance = new Queue(QUEUE.maintenance, opts);
  }

  async scheduleReminders(classSessionId: string, startsAt: Date, now = new Date()): Promise<number> {
    const due = reminderSchedule(startsAt, now);
    await Promise.all(
      due.map((r) =>
        this.reminders.add(
          "send",
          { classSessionId, kind: r.kind, startsAtMs: startsAt.getTime() },
          { delay: r.delayMs, jobId: reminderJobId(classSessionId, r.kind, startsAt.getTime()) },
        ),
      ),
    );
    return due.length;
  }

  async cancelReminders(classSessionId: string, startsAt: Date): Promise<void> {
    await Promise.all(
      (["24h", "15m"] as const).map((kind) =>
        this.reminders.remove(reminderJobId(classSessionId, kind, startsAt.getTime())),
      ),
    );
  }

  async enqueueTranscode(videoId: string): Promise<void> {
    await this.transcode.add("transcode", { videoId }, { jobId: `transcode_${videoId}` });
  }

  async enqueueRecordingSync(classSessionId: string, delayMs = 0): Promise<void> {
    // One pending sync per class; the sweep re-enqueues after it completes.
    await this.recordingSync.add(
      "sync",
      { classSessionId },
      { jobId: `recsync_${classSessionId}`, delay: delayMs, removeOnComplete: true, removeOnFail: true },
    );
  }

  /** Debounced: Google sends bursts of pushes; one pending sync per teacher is enough. */
  async enqueueCalendarSync(userId: string): Promise<void> {
    await this.calendarSync.add(
      "sync",
      { userId },
      { jobId: `calsync_${userId}`, delay: 5_000, removeOnComplete: true, removeOnFail: true },
    );
  }

  async close(): Promise<void> {
    await Promise.all([
      this.reminders.close(),
      this.recordingSync.close(),
      this.transcode.close(),
      this.calendarSync.close(),
      this.maintenance.close(),
    ]);
  }
}
