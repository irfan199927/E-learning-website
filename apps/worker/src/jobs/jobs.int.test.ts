import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classWorld, fakeJobs, fakeStorage, makeCtx, stubGoogle, testDb } from "../test/ctx";
import { syncCalendar } from "./calendar-sync";
import { abortStaleUploads, sweepClasses } from "./maintenance";
import { RECORDINGS_MODULE_TITLE, syncRecording } from "./recording-sync";
import { sendReminder } from "./reminder";
import { transcodeVideo } from "./transcode";

describe("reminder job", () => {
  it("notifies students (and parents for 24h) exactly once", async () => {
    const w = await classWorld();
    const ctx = makeCtx();
    const job = { classSessionId: w.cls.id, kind: "24h" as const, startsAtMs: w.cls.startsAt.getTime() };

    expect((await sendReminder(ctx, job)).sent).toBe(2); // student + parent
    expect((await sendReminder(ctx, job)).sent).toBe(0); // retry is a no-op
    expect(ctx.mailer.sent.map((m) => m.to).sort()).toEqual([w.parent.email, w.student.email].sort());

    const ctx15 = makeCtx();
    expect((await sendReminder(ctx15, { ...job, kind: "15m" })).sent).toBe(1); // parents skip 15m
  });

  it("skips stale reminders after a reschedule or cancellation", async () => {
    const w = await classWorld();
    const ctx = makeCtx();
    expect(await sendReminder(ctx, { classSessionId: w.cls.id, kind: "15m", startsAtMs: 1 })).toEqual({
      sent: 0,
      skipped: "class rescheduled",
    });
    await testDb().classSession.update({ where: { id: w.cls.id }, data: { status: "CANCELLED" } });
    expect(
      (
        await sendReminder(ctx, {
          classSessionId: w.cls.id,
          kind: "15m",
          startsAtMs: w.cls.startsAt.getTime(),
        })
      ).skipped,
    ).toBe("class cancelled");
  });
});

describe("recording sync job", () => {
  const past = () => {
    const startsAt = new Date(Date.now() - 2 * 3600_000);
    return { startsAt, endsAt: new Date(startsAt.getTime() + 60 * 60_000) };
  };

  it("imports the recording, creates a lesson, and records attendance", async () => {
    const w = await classWorld(past());
    const storage = fakeStorage();
    const jobs = fakeJobs();
    const google = stubGoogle({
      findConferenceRecords: async () => [
        { name: "conferenceRecords/r1", startTime: w.cls.startsAt, endTime: w.cls.endsAt },
      ],
      listRecordings: async () => [
        {
          name: "rec1",
          state: "FILE_GENERATED",
          driveFileId: `drive-${w.tag}`,
          startTime: null,
          endTime: null,
        },
      ],
      listParticipantSessions: async () => [
        {
          googleUserId: w.googleSub,
          displayName: "Student",
          sessions: [{ start: w.cls.startsAt, end: new Date(w.cls.startsAt.getTime() + 40 * 60_000) }],
        },
        {
          googleUserId: "unknown-person",
          displayName: "Guest",
          sessions: [{ start: w.cls.startsAt, end: w.cls.endsAt }],
        },
      ],
    });
    const ctx = makeCtx({ storage, jobs, googleFor: async () => google });

    const res = await syncRecording(ctx, { classSessionId: w.cls.id });
    expect(res).toEqual({ outcome: "synced", recordings: 1, attendance: 1 });

    const video = await testDb().video.findFirstOrThrow({ where: { classSessionId: w.cls.id } });
    expect(video.status).toBe("UPLOADED");
    expect(storage.puts.get(video.rawKey!)).toBe(1024);
    expect(jobs.log).toContain(`transcode:${video.id}`);
    const lesson = await testDb().lesson.findFirstOrThrow({
      where: { videoId: video.id },
      include: { module: true },
    });
    expect(lesson.module.title).toBe(RECORDINGS_MODULE_TITLE);
    const att = await testDb().attendance.findFirstOrThrow({ where: { classSessionId: w.cls.id } });
    expect(att).toMatchObject({
      userId: w.student.id,
      present: true,
      durationSeconds: 2400,
      source: "MEET_API",
    });

    // Second run: already synced → no duplicate import.
    expect((await syncRecording(ctx, { classSessionId: w.cls.id })).outcome).toBe("no-class");
  });

  it("keeps waiting while Meet is still processing, never overwrites manual attendance", async () => {
    const w = await classWorld(past());
    await testDb().attendance.create({
      data: { classSessionId: w.cls.id, userId: w.student.id, source: "MANUAL", present: true },
    });
    const google = stubGoogle({
      findConferenceRecords: async () => [{ name: "r", startTime: w.cls.startsAt, endTime: w.cls.endsAt }],
      listRecordings: async () => [
        { name: "rec", state: "STARTED", driveFileId: null, startTime: null, endTime: null },
      ],
      listParticipantSessions: async () => [{ googleUserId: w.googleSub, displayName: "S", sessions: [] }],
    });
    const res = await syncRecording(makeCtx({ googleFor: async () => google }), { classSessionId: w.cls.id });
    expect(res.outcome).toBe("not-ready");
    expect((await testDb().attendance.findFirstOrThrow({ where: { classSessionId: w.cls.id } })).source).toBe(
      "MANUAL",
    );
  });

  it("gives up after 24 h and tells the teacher", async () => {
    const startsAt = new Date(Date.now() - 30 * 3600_000);
    const w = await classWorld({ startsAt, endsAt: new Date(startsAt.getTime() + 3600_000) });
    const res = await syncRecording(makeCtx(), { classSessionId: w.cls.id });
    expect(res.outcome).toBe("gave-up");
    expect(
      await testDb().notification.count({ where: { userId: w.teacher.id, type: "class.recording.issue" } }),
    ).toBe(1);
  });
});

describe("calendar sync job", () => {
  it("mirrors moves and cancellations made in Google Calendar", async () => {
    const w = await classWorld();
    const other = await classWorld();
    await testDb().classSession.update({ where: { id: other.cls.id }, data: { hostId: w.teacher.id } });
    await testDb().watchChannel.create({
      data: {
        id: `ch-${w.tag}`,
        resourceId: "r",
        kind: "calendar",
        userId: w.teacher.id,
        tokenHash: "x",
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const newStart = new Date(w.cls.startsAt.getTime() + 3600_000);
    const google = stubGoogle({
      listChangedEvents: async () => ({
        events: [
          {
            eventId: w.cls.googleEventId!,
            status: "confirmed",
            startsAt: newStart,
            endsAt: new Date(newStart.getTime() + 45 * 60_000),
          },
          { eventId: other.cls.googleEventId!, status: "cancelled", startsAt: null, endsAt: null },
          { eventId: "not-ours", status: "confirmed", startsAt: newStart, endsAt: newStart },
        ],
        nextSyncToken: "next-token",
      }),
    });
    const jobs = fakeJobs();
    const res = await syncCalendar(makeCtx({ jobs, googleFor: async () => google }), {
      userId: w.teacher.id,
    });
    expect(res).toEqual({ updated: 1, cancelled: 1 });
    expect((await testDb().classSession.findUniqueOrThrow({ where: { id: w.cls.id } })).startsAt).toEqual(
      newStart,
    );
    expect((await testDb().classSession.findUniqueOrThrow({ where: { id: other.cls.id } })).status).toBe(
      "CANCELLED",
    );
    expect((await testDb().watchChannel.findUniqueOrThrow({ where: { id: `ch-${w.tag}` } })).syncToken).toBe(
      "next-token",
    );
    expect(jobs.log).toContain(`remind:${w.cls.id}`);
  });
});

describe("maintenance", () => {
  it("moves ended classes to ENDED and queues recording sync", async () => {
    const startsAt = new Date(Date.now() - 2 * 3600_000);
    const w = await classWorld({ startsAt, endsAt: new Date(startsAt.getTime() + 3600_000) });
    const jobs = fakeJobs();
    await sweepClasses(makeCtx({ jobs }));
    expect((await testDb().classSession.findUniqueOrThrow({ where: { id: w.cls.id } })).status).toBe("ENDED");
    expect(jobs.log).toContain(`recsync:${w.cls.id}`);
  });

  it("fails uploads abandoned for more than a day", async () => {
    const w = await classWorld();
    const v = await testDb().video.create({
      data: {
        title: "x",
        source: "UPLOAD",
        status: "PENDING_UPLOAD",
        uploaderId: w.teacher.id,
        courseId: w.course.id,
        createdAt: new Date(Date.now() - 2 * 86_400_000),
        rawKey: "k",
        uploadId: "u",
      },
    });
    await abortStaleUploads(makeCtx());
    expect((await testDb().video.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("FAILED");
  });
});

describe("transcode job (real ffmpeg)", () => {
  it("produces HLS renditions + thumbnail and marks the video READY", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tc-"));
    const input = join(dir, "in.mp4");
    // 8-second 720p test pattern with a tone.
    execFileSync("ffmpeg", [
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=1280x720:rate=25:duration=8",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=8",
      "-shortest",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      input,
    ]);

    const w = await classWorld();
    const v = await testDb().video.create({
      data: {
        title: "Upload",
        source: "UPLOAD",
        status: "UPLOADED",
        uploaderId: w.teacher.id,
        courseId: w.course.id,
        rawKey: "videos/x/raw.mp4",
      },
    });
    const storage = fakeStorage();
    const res = await transcodeVideo(makeCtx({ storage }), { videoId: v.id }, { inputOverride: input });

    expect(res).toMatchObject({ renditions: ["360p", "720p"], durationSeconds: 8 });
    const keys = [...storage.puts.keys()];
    expect(keys).toContain(`videos/${v.id}/hls/master.m3u8`);
    expect(keys).toContain(`videos/${v.id}/hls/720p/index.m3u8`);
    expect(keys.some((k) => k.endsWith("360p/seg_000.ts"))).toBe(true);
    expect(keys).toContain(`videos/${v.id}/thumb.jpg`);
    const after = await testDb().video.findUniqueOrThrow({ where: { id: v.id } });
    expect(after).toMatchObject({ status: "READY", durationSeconds: 8, hlsPrefix: `videos/${v.id}/hls/` });
  });
});
