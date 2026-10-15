/**
 * After a class ends: pull Meet recordings from the host's Drive into storage, attach
 * them to the course as lessons, and fill attendance from Meet participant sessions.
 *
 * Runs repeatedly (the maintenance sweep re-enqueues every 10 min) until a recording is
 * found or 24 h pass, then gives up and tells the teacher to upload manually.
 * Runbook: docs/runbooks/recording-sync.md
 */
import { computeAttendance, isAppError } from "@elearner/core";
import type { RecordingSyncJob } from "@elearner/queue";
import { extensionFor, keys } from "@elearner/storage";
import type { JobContext } from "../context";

export const RECORDING_GIVE_UP_MS = 24 * 3600_000;
const MATCH_WINDOW_MS = 30 * 60_000;
export const RECORDINGS_MODULE_TITLE = "Class recordings";

export type SyncOutcome = "no-class" | "not-ready" | "synced" | "gave-up" | "needs-reconnect";

export async function syncRecording(
  ctx: JobContext,
  job: RecordingSyncJob,
): Promise<{ outcome: SyncOutcome; recordings: number; attendance: number }> {
  const cls = await ctx.db.classSession.findUnique({ where: { id: job.classSessionId } });
  if (!cls || !cls.meetConferenceId || cls.recordingSyncedAt)
    return { outcome: "no-class", recordings: 0, attendance: 0 };
  const now = ctx.now();

  let google;
  try {
    google = await ctx.googleFor(cls.hostId);
  } catch (err) {
    if (isAppError(err) && err.code === "GOOGLE_RECONNECT_REQUIRED") {
      await notifyHost(
        ctx,
        cls.hostId,
        cls.id,
        "google",
        "Reconnect Google to get your class recordings",
        "Your Google connection expired, so we can't fetch recordings.",
      );
      return { outcome: "needs-reconnect", recordings: 0, attendance: 0 };
    }
    throw err;
  }

  await ctx.db.classSession.update({ where: { id: cls.id }, data: { recordingSyncTries: { increment: 1 } } });
  const records = await google.findConferenceRecords(cls.meetConferenceId, {
    from: new Date(cls.startsAt.getTime() - MATCH_WINDOW_MS),
    to: new Date(cls.endsAt.getTime() + MATCH_WINDOW_MS),
  });

  // ── Attendance (independent of recordings) ──
  let attendance = 0;
  for (const record of records) attendance += await syncAttendance(ctx, google, record.name, cls);

  // ── Recordings ──
  let imported = 0;
  let pending = 0;
  for (const record of records) {
    for (const rec of await google.listRecordings(record.name)) {
      if (rec.state !== "FILE_GENERATED" || !rec.driveFileId) {
        pending++;
        continue;
      }
      const exists = await ctx.db.video.findUnique({ where: { driveFileId: rec.driveFileId } });
      if (exists) continue;
      await importRecording(ctx, google, cls, rec.driveFileId, records.length > 1 ? imported + 1 : null);
      imported++;
    }
  }

  const anyImported = imported > 0 || (await ctx.db.video.count({ where: { classSessionId: cls.id } })) > 0;
  if (anyImported && pending === 0) {
    await ctx.db.classSession.update({ where: { id: cls.id }, data: { recordingSyncedAt: now } });
    return { outcome: "synced", recordings: imported, attendance };
  }
  if (now.getTime() - cls.endsAt.getTime() > RECORDING_GIVE_UP_MS) {
    await ctx.db.classSession.update({ where: { id: cls.id }, data: { recordingSyncedAt: now } });
    await notifyHost(
      ctx,
      cls.hostId,
      cls.id,
      "recording",
      `No recording found for "${cls.title}"`,
      "Upload the video manually from the Library if you recorded it elsewhere.",
    );
    return { outcome: "gave-up", recordings: imported, attendance };
  }
  return { outcome: "not-ready", recordings: imported, attendance };
}

type Cls = { id: string; courseId: string; hostId: string; title: string; startsAt: Date; endsAt: Date };
type Google = Awaited<ReturnType<JobContext["googleFor"]>>;

async function importRecording(
  ctx: JobContext,
  google: Google,
  cls: Cls,
  driveFileId: string,
  part: number | null,
) {
  const file = await google.downloadDriveFile(driveFileId);
  const mime = file.mimeType ?? "video/mp4";
  const title = `${cls.title} — ${cls.startsAt.toISOString().slice(0, 10)}${part ? ` (part ${part})` : ""}`;
  const video = await ctx.db.video.create({
    data: {
      title,
      source: "MEET_RECORDING",
      status: "PENDING_UPLOAD",
      uploaderId: cls.hostId,
      courseId: cls.courseId,
      classSessionId: cls.id,
      driveFileId,
      mimeType: mime,
      sizeBytes: file.size !== null ? BigInt(file.size) : null,
    },
  });
  const rawKey = keys.videoRaw(video.id, extensionFor(mime));
  try {
    await ctx.storage.putStream(rawKey, file.stream, mime);
  } catch (err) {
    await ctx.db.video.delete({ where: { id: video.id } }); // let the next run retry cleanly
    throw err;
  }
  await ctx.db.video.update({ where: { id: video.id }, data: { rawKey, status: "UPLOADED" } });

  const module =
    (await ctx.db.module.findFirst({ where: { courseId: cls.courseId, title: RECORDINGS_MODULE_TITLE } })) ??
    (await ctx.db.module.create({
      data: { courseId: cls.courseId, title: RECORDINGS_MODULE_TITLE, position: 999 },
    }));
  const position = await ctx.db.lesson.count({ where: { moduleId: module.id } });
  await ctx.db.lesson.create({
    data: {
      moduleId: module.id,
      title,
      type: "VIDEO",
      position: position + 1,
      videoId: video.id,
      publishedAt: ctx.now(),
    },
  });
  await ctx.jobs.enqueueTranscode(video.id);
  ctx.log.info({ classId: cls.id, videoId: video.id }, "meet recording imported");
}

async function syncAttendance(
  ctx: JobContext,
  google: Google,
  recordName: string,
  cls: Cls,
): Promise<number> {
  const participants = await google.listParticipantSessions(recordName);
  const googleIds = participants.map((p) => p.googleUserId).filter((x): x is string => !!x);
  if (googleIds.length === 0) return 0;

  // Meet gives Google account ids; Account.accountId stores the same id for Google logins.
  const accounts = await ctx.db.account.findMany({
    where: {
      providerId: "google",
      accountId: { in: googleIds },
      user: { enrollments: { some: { courseId: cls.courseId } } },
    },
    select: { accountId: true, userId: true },
  });
  const userByGoogleId = new Map(accounts.map((a) => [a.accountId, a.userId]));

  let written = 0;
  for (const p of participants) {
    const userId = p.googleUserId ? userByGoogleId.get(p.googleUserId) : undefined;
    if (!userId) continue;
    const result = computeAttendance(
      p.sessions,
      { start: cls.startsAt, end: cls.endsAt },
      ctx.config.presentRatio,
    );
    const existing = await ctx.db.attendance.findUnique({
      where: { classSessionId_userId: { classSessionId: cls.id, userId } },
    });
    if (existing?.source === "MANUAL") continue; // teacher's manual mark always wins
    await ctx.db.attendance.upsert({
      where: { classSessionId_userId: { classSessionId: cls.id, userId } },
      create: { classSessionId: cls.id, userId, source: "MEET_API", ...result },
      update: { source: "MEET_API", ...result },
    });
    written++;
  }
  return written;
}

async function notifyHost(
  ctx: JobContext,
  userId: string,
  classId: string,
  kind: string,
  title: string,
  body: string,
) {
  await ctx.db.notification.createMany({
    data: [
      {
        userId,
        channel: "IN_APP",
        type: `class.${kind}.issue`,
        title,
        body,
        link: "/calendar",
        dedupeKey: `host_${kind}_${classId}`,
      },
    ],
    skipDuplicates: true,
  });
}
