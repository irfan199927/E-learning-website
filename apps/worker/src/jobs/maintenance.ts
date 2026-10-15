/**
 * Scheduled housekeeping. Each task is small, idempotent and safe to run concurrently
 * with user traffic. Schedules are registered in src/index.ts.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { sha256Hex } from "@elearner/core";
import type { MaintenanceJob } from "@elearner/queue";
import type { JobContext } from "../context";
import { RECORDING_GIVE_UP_MS } from "./recording-sync";

const SYNC_GRACE_MS = 10 * 60_000; // Meet needs a few minutes to produce the file
const STALE_UPLOAD_MS = 24 * 3600_000;
const ERASURE_GRACE_MS = 30 * 24 * 3600_000; // DPDP: soft-delete, then purge after 30 days

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
 * Hard-delete users soft-deleted > 30 days ago (DPDP erasure). Teachers who own content
 * are skipped and logged for an admin to reassign first — we never orphan a course.
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
    await ctx.db.$transaction([
      ctx.db.auditLog.create({ data: { action: "user.purge", targetType: "User", targetId: u.id } }),
      ctx.db.user.delete({ where: { id: u.id } }),
    ]);
    purged++;
  }
  return { purged };
}
