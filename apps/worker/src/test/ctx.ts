import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { createDb, type Db, Role } from "@elearner/db";
import type { TeacherGoogle } from "@elearner/google";
import { createMemoryMailer } from "@elearner/notify";
import pino from "pino";
import type { JobContext, WorkerJobs, WorkerStorage } from "../context";

let db: Db | undefined;
export const testDb = () =>
  (db ??= createDb(process.env.DATABASE_URL ?? "postgresql://elearner:elearner@127.0.0.1:5432/elearner"));

export function fakeStorage(): WorkerStorage & {
  puts: Map<string, number>;
  deleted: string[];
  prefixes: string[];
} {
  const puts = new Map<string, number>();
  const deleted: string[] = [];
  const prefixes: string[] = [];
  return {
    puts,
    deleted,
    prefixes,
    putStream: async (key, body) => {
      let bytes = 0;
      if (Buffer.isBuffer(body)) bytes = body.length;
      else for await (const chunk of body as Readable) bytes += (chunk as Buffer).length;
      puts.set(key, bytes);
    },
    presignGet: async (key) => `https://storage.test/${key}`,
    abortMultipart: async () => undefined,
    deleteObject: async (key) => void deleted.push(key),
    deletePrefix: async (prefix) => (prefixes.push(prefix), 0),
  };
}

export function fakeJobs(): WorkerJobs & { log: string[] } {
  const log: string[] = [];
  return {
    log,
    scheduleReminders: async (id) => (log.push(`remind:${id}`), 2),
    cancelReminders: async (id) => void log.push(`cancel:${id}`),
    enqueueTranscode: async (id) => void log.push(`transcode:${id}`),
    enqueueRecordingSync: async (id) => void log.push(`recsync:${id}`),
  };
}

export function stubGoogle(over: Partial<TeacherGoogle> = {}): TeacherGoogle {
  const nope = async () => {
    throw new Error("not stubbed");
  };
  return {
    createClassEvent: nope,
    rescheduleEvent: nope,
    cancelEvent: nope,
    findConferenceRecords: async () => [],
    listRecordings: async () => [],
    listParticipantSessions: async () => [],
    downloadDriveFile: async () => ({
      stream: Readable.from([Buffer.alloc(1024)]),
      name: "rec.mp4",
      mimeType: "video/mp4",
      size: 1024,
    }),
    watchCalendar: nope,
    stopChannel: async () => undefined,
    listChangedEvents: async () => ({ events: [], nextSyncToken: null }),
    ...over,
  };
}

export function makeCtx(
  over: Partial<JobContext> = {},
): JobContext & { mailer: ReturnType<typeof createMemoryMailer> } {
  return {
    db: testDb(),
    storage: fakeStorage(),
    jobs: fakeJobs(),
    mailer: createMemoryMailer(),
    googleFor: async () => stubGoogle(),
    now: () => new Date(),
    log: pino({ level: "silent" }),
    config: {
      appUrl: "http://localhost:3000",
      presentRatio: 0.5,
      ffmpegPath: "ffmpeg",
      ffprobePath: "ffprobe",
      tmpDir: tmpdir(),
    },
    ...over,
  } as JobContext & { mailer: ReturnType<typeof createMemoryMailer> };
}

/** A course with a teacher, an enrolled student (Google-linked), a verified parent and one class. */
export async function classWorld(opts: { startsAt?: Date; endsAt?: Date } = {}) {
  const d = testDb();
  const tag = randomUUID().slice(0, 8);
  const mk = (role: Role, name: string) =>
    d.user.create({
      data: { email: `${name}-${tag}@test.local`, name, role, emailVerified: true, isActive: true },
    });
  const [teacher, student, parent] = await Promise.all([
    mk(Role.TEACHER, "teacher"),
    mk(Role.STUDENT, "student"),
    mk(Role.PARENT, "parent"),
  ]);
  const googleSub = `g-${tag}`;
  await d.account.create({ data: { userId: student.id, providerId: "google", accountId: googleSub } });
  const course = await d.course.create({
    data: { slug: `c-${tag}`, title: `Course ${tag}`, teacherId: teacher.id },
  });
  await d.enrollment.create({ data: { userId: student.id, courseId: course.id } });
  await d.parentLink.create({ data: { parentId: parent.id, studentId: student.id, verifiedAt: new Date() } });
  const startsAt = opts.startsAt ?? new Date(Date.now() + 86_400_000);
  const cls = await d.classSession.create({
    data: {
      courseId: course.id,
      hostId: teacher.id,
      title: "Quadratics",
      startsAt,
      endsAt: opts.endsAt ?? new Date(startsAt.getTime() + 45 * 60_000),
      googleEventId: `evt-${tag}`,
      meetLink: "https://meet.google.com/abc-defg-hij",
      meetConferenceId: `abc-${tag}`,
    },
  });
  return { teacher, student, parent, course, cls, googleSub, tag };
}
