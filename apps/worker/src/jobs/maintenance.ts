/**
 * Scheduled housekeeping. Each task is small, idempotent and safe to run concurrently
 * with user traffic. Schedules are registered in src/index.ts.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { ERASURE_GRACE_DAYS, sha256Hex } from "@elearner/core";
import type { MaintenanceJob } from "@elearner/queue";
import type { JobContext } from "../context";
import { RECORDING_GIVE_UP_MS } from "./recording-sync";

const SYNC_GRACE_MS = 10 * 60_000; // Meet needs a few minutes to produce the file
const STALE_UPLOAD_MS = 24 * 3600_000;
const ERASURE_GRACE_MS = ERASURE_GRACE_DAYS * 24 * 3600_000; // DPDP: soft-delete, then purge after 30 days
/** Reminders are delayed jobs in Redis; re-add any for classes this far ahead (covers the 24 h reminder). */
const REMINDER_HORIZON_MS = 48 * 3600_000;
/** Originals are kept this long after transcoding, in case a rendition must be redone. */
const RAW_RETENTION_MS = 30 * 24 * 3600_000;

export async function runMaintenance(ctx: JobContext, job: MaintenanceJob): Promise<Record<string, number>> {
  switch (job.task) {
    case "sweep-ended-classes":
      return sweepClasses(ctx);
    case "renew-watch-channels":
      return renewWatchChannels(ctx);
    case "abort-stale-uploads":
      return abortStaleUploads(ctx);
    case "purge-deleted-users":
      return purgeDeletedUsers(ctx);
    case "reconcile-reminders":
      return reconcileReminders(ctx);
    case "delete-transcoded-raw":
      return deleteTranscodedRaw(ctx);
  }
}

/** Move classes through SCHEDULED → LIVE → ENDED, then queue recording sync for ended ones. */
export async function sweepClasses(ctx: JobContext) {
  const now = ctx.now();
  const live = await ctx.db.classSession.updateMany({
    where: { status: "SCHEDULED", startsAt: { lte: now }, endsAt: { gt: now } },
    data: { status: "LIVE" },
  });
  const ended = await ctx.db.classSession.updateMany({
    where: { status: { in: ["SCHEDULED", "LIVE"] }, endsAt: { lte: now } },
    data: { status: "ENDED" },
  });
  const due = await ctx.db.classSession.findMany({
    where: {
      status: "ENDED",
      autoAttachRecording: true,
      recordingSyncedAt: null,
      meetConferenceId: { not: null },
      endsAt: {
        lte: new Date(now.getTime() - SYNC_GRACE_MS),
        gte: new Date(now.getTime() - RECORDING_GIVE_UP_MS - 3600_000),
      },
    },
    select: { id: true },
    take: 200,
  });
  for (const c of due) await ctx.jobs.enqueueRecordingSync(c.id);
  return { live: live.count, ended: ended.count, queued: due.length };
}

/** Google Calendar channels expire; replace any expiring in the next 48 h. */
export async function renewWatchChannels(ctx: JobContext) {
  if (!ctx.config.appUrl.startsWith("https://")) return { renewed: 0 };
  const expiring = await ctx.db.watchChannel.findMany({
    where: { kind: "calendar", expiresAt: { lt: new Date(ctx.now().getTime() + 48 * 3600_000) } },
  });
  let renewed = 0;
  for (const ch of expiring) {
    try {
      const google = await ctx.googleFor(ch.userId);
      const id = randomUUID();
      const token = randomBytes(24).toString("base64url");
      const res = await google.watchCalendar(
        id,
        `${ctx.config.appUrl}/api/v1/google/webhooks/calendar`,
        token,
        7 * 24 * 3600,
      );
      await ctx.db.$transaction([
        ctx.db.watchChannel.create({
          data: {
            id,
            resourceId: res.resourceId,
            kind: "calendar",
            userId: ch.userId,
            tokenHash: sha256Hex(token),
            syncToken: ch.syncToken,
            expiresAt: res.expiresAt,
          },
        }),
        ctx.db.watchChannel.delete({ where: { id: ch.id } }),
      ]);
      await google.stopChannel(ch.id, ch.resourceId).catch(() => undefined);
      renewed++;
    } catch (err) {
      ctx.log.warn({ err, channelId: ch.id }, "watch channel renewal failed");
    }
  }
  return { renewed };
}

export async function abortStaleUploads(ctx: JobContext) {
  const stale = await ctx.db.video.findMany({
    where: {
      status: "PENDING_UPLOAD",
      source: "UPLOAD",
      createdAt: { lt: new Date(ctx.now().getTime() - STALE_UPLOAD_MS) },
    },
    select: { id: true, rawKey: true, uploadId: true },
  });
  for (const v of stale) {
    if (v.rawKey && v.uploadId) await ctx.storage.abortMultipart(v.rawKey, v.uploadId).catch(() => undefined);
    await ctx.db.video.update({
      where: { id: v.id },
      data: { status: "FAILED", uploadId: null, error: "Upload abandoned" },
    });
  }
  return { aborted: stale.length };
}

/**
 * Re-add reminder jobs for upcoming classes, so a Redis flush or failover loses at most one run's worth of
 * reminders (architecture.md G4). Safe to repeat: job ids are deterministic (an existing job is left alone)
 * and the reminder job dedupes per user in the database, so nobody is reminded twice.
 */
export async function reconcileReminders(ctx: JobContext) {
  const now = ctx.now();
  const upcoming = await ctx.db.classSession.findMany({
    where: { status: "SCHEDULED", startsAt: { gt: now, lte: new Date(now.getTime() + REMINDER_HORIZON_MS) } },
    select: { id: true, startsAt: true },
  });
  let scheduled = 0;
  for (const c of upcoming) scheduled += await ctx.jobs.scheduleReminders(c.id, c.startsAt, now);
  return { classes: upcoming.length, scheduled };
}

/**
 * Delete original uploads and recordings 30 days after they were transcoded (architecture.md G6).
 * Students only ever stream the HLS renditions; the original costs storage forever otherwise.
 * `updatedAt` is when the video last changed, which is at or after it became READY, so this never
 * deletes early. After this a video can't be re-transcoded; Meet recordings are still in the teacher's Drive.
 */
export async function deleteTranscodedRaw(ctx: JobContext) {
  const old = await ctx.db.video.findMany({
    where: {
      status: "READY",
      rawKey: { not: null },
      updatedAt: { lt: new Date(ctx.now().getTime() - RAW_RETENTION_MS) },
    },
    select: { id: true, rawKey: true },
    take: 500,
  });
  for (const v of old) {
    await ctx.storage.deleteObject(v.rawKey!);
    await ctx.db.video.update({ where: { id: v.id }, data: { rawKey: null } });
  }
  return { deleted: old.length };
}

/**
 * Hard-delete users soft-deleted > 30 days ago (DPDP erasure), with their submission files and payment screenshots. Teachers who own
 * content are skipped and logged for an admin to reassign first — we never orphan a course.
 */
export async function purgeDeletedUsers(ctx: JobContext) {
  const cutoff = new Date(ctx.now().getTime() - ERASURE_GRACE_MS);
  const users = await ctx.db.user.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: {
      id: true,
      _count: { select: { coursesTaught: true, videosUploaded: true, classesHosted: true } },
    },
  });
  let purged = 0;
  for (const u of users) {
    if (u._count.coursesTaught || u._count.videosUploaded || u._count.classesHosted) {
      ctx.log.warn({ userId: u.id }, "erasure blocked: user still owns content; reassign it first");
      continue;
    }
    // Submission files live in storage, not the database: delete them before the rows that point at them.
    const subs = await ctx.db.submission.findMany({ where: { userId: u.id }, select: { fileKeys: true } });
    for (const key of subs.flatMap((s) => s.fileKeys)) await ctx.storage.deleteObject(key);
    await ctx.storage.deletePrefix(`payments/proofs/${u.id}/`); // payment screenshots (keys.paymentProofPrefix)
    await ctx.db.$transaction([
      ctx.db.auditLog.create({ data: { action: "user.purge", targetType: "User", targetId: u.id } }),
      ctx.db.user.delete({ where: { id: u.id } }),
    ]);
    purged++;
  }
  return { purged };
}
