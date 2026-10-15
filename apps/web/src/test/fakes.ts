/**
 * Test doubles for Deps. Integration tests use a REAL database and these fakes for the
 * outside world (Google, storage, queues, email), so business rules are tested end-to-end
 * without network calls.
 */
import { randomUUID } from "node:crypto";
import { createDb, type Db, Role } from "@elearner/db";
import type { CreatedEvent, CredentialStore, TeacherGoogle } from "@elearner/google";
import { createMemoryMailer } from "@elearner/notify";
import type { Actor, Deps, JobsPort, StoragePort } from "@/server/deps";

let sharedDb: Db | undefined;
export function testDb(): Db {
  sharedDb ??= createDb(process.env.DATABASE_URL ?? "postgresql://elearner:elearner@127.0.0.1:5432/elearner");
  return sharedDb;
}

export function fakeGoogle(
  overrides: Partial<TeacherGoogle> = {},
): TeacherGoogle & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {};
  const track =
    <A extends unknown[], R>(name: string, fn: (...a: A) => Promise<R>) =>
    (...a: A) => {
      (calls[name] ??= []).push(a);
      return fn(...a);
    };
  const base: TeacherGoogle = {
    createClassEvent: async (input): Promise<CreatedEvent> => ({
      eventId: `evt_${randomUUID().slice(0, 8)}`,
      etag: "etag-1",
      meetLink: "https://meet.google.com/abc-defg-hij",
      conferenceId: "abc-defg-hij",
      instances: [
        { eventId: `inst_${randomUUID().slice(0, 8)}`, startsAt: input.startsAt, endsAt: input.endsAt },
      ],
    }),
    rescheduleEvent: async () => ({ etag: "etag-2" }),
    cancelEvent: async () => undefined,
    findConferenceRecords: async () => [],
    listRecordings: async () => [],
    listParticipantSessions: async () => [],
    downloadDriveFile: async () => {
      throw new Error("not used");
    },
    watchCalendar: async () => ({ resourceId: "res-1", expiresAt: new Date(Date.now() + 86_400_000) }),
    stopChannel: async () => undefined,
    listChangedEvents: async () => ({ events: [], nextSyncToken: "tok" }),
  };
  const merged = { ...base, ...overrides };
  const tracked = Object.fromEntries(
    Object.entries(merged).map(([k, fn]) => [k, track(k, fn as never)]),
  ) as unknown as TeacherGoogle;
  return Object.assign(tracked, { calls });
}

export function fakeJobs(): JobsPort & { log: string[] } {
  const log: string[] = [];
  return {
    log,
    scheduleReminders: async (id, startsAt) => (log.push(`remind:${id}:${startsAt.toISOString()}`), 2),
    cancelReminders: async (id, startsAt) => void log.push(`cancel:${id}:${startsAt.toISOString()}`),
    enqueueTranscode: async (id) => void log.push(`transcode:${id}`),
    enqueueRecordingSync: async (id) => void log.push(`recsync:${id}`),
    enqueueCalendarSync: async (id) => void log.push(`calsync:${id}`),
  };
}

export function fakeStorage(files: Record<string, string> = {}): StoragePort & { completed: string[] } {
  const completed: string[] = [];
  return {
    completed,
    createMultipart: async () => "upload-123",
    presignPart: async (key, uploadId, n) =>
      `https://storage.test/${key}?uploadId=${uploadId}&partNumber=${n}`,
    completeMultipart: async (key) => void completed.push(key),
    abortMultipart: async () => undefined,
    presignGet: async (key, ttl) => `https://storage.test/${key}?ttl=${ttl}`,
    head: async () => ({ size: 1234, contentType: "video/mp4" }),
    getText: async (key) => {
      const f = files[key];
      if (f === undefined) throw new Error("NoSuchKey");
      return f;
    },
  };
}

const noCredentials: CredentialStore = {
  load: async () => null,
  saveGrant: async () => undefined,
  saveAccessToken: async () => undefined,
  saveRefreshToken: async () => undefined,
  markRevoked: async () => undefined,
};

export function makeDeps(over: Partial<Deps> & { google?: TeacherGoogle } = {}): Deps {
  const google = over.google ?? fakeGoogle();
  return {
    db: testDb(),
    storage: fakeStorage(),
    jobs: fakeJobs(),
    mailer: createMemoryMailer(),
    credentials: noCredentials,
    googleFor: async () => google,
    now: () => new Date(),
    config: {
      appUrl: "http://localhost:3000",
      authSecret: "test-secret-test-secret-test-secret",
      maxUploadBytes: 4 * 1024 ** 3,
      joinOpensMinutesBefore: 10,
      google: {
        clientId: "cid",
        clientSecret: "sec",
        redirectUri: "http://localhost:3000/api/v1/google/callback",
      },
    },
    ...over,
  };
}

/** Isolated fixture world per test: unique emails/slugs so tests can run against a shared DB. */
export async function world() {
  const db = testDb();
  const tag = randomUUID().slice(0, 8);
  const mk = (role: Role, name: string) =>
    db.user.create({
      data: { email: `${name}-${tag}@test.local`, name, role, emailVerified: true, isActive: true },
    });
  const [admin, teacher, otherTeacher, student, outsider, parent] = await Promise.all([
    mk(Role.ADMIN, "admin"),
    mk(Role.TEACHER, "teacher"),
    mk(Role.TEACHER, "other-teacher"),
    mk(Role.STUDENT, "student"),
    mk(Role.STUDENT, "outsider"),
    mk(Role.PARENT, "parent"),
  ]);
  const course = await db.course.create({
    data: { slug: `maths-${tag}`, title: `Maths ${tag}`, teacherId: teacher.id },
  });
  await db.enrollment.create({ data: { userId: student.id, courseId: course.id } });
  await db.parentLink.create({
    data: { parentId: parent.id, studentId: student.id, verifiedAt: new Date() },
  });
  const actor = (u: { id: string; email: string; name: string; role: Role }): Actor => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    timezone: "Asia/Kolkata",
  });
  return {
    course,
    admin: actor(admin),
    teacher: actor(teacher),
    otherTeacher: actor(otherTeacher),
    student: actor(student),
    outsider: actor(outsider),
    parent: actor(parent),
  };
}
