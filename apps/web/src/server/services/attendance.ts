/**
 * Class attendance, marked by the teacher. Google Meet classes also get attendance automatically after the class
 * (worker recording-sync, source MEET_API); a teacher's mark (source MANUAL) always wins, and the worker never
 * overwrites it. Parents see the result (parents.ts).
 *
 * Who can mark: the class host, the course teacher, or an admin, once the class has started. Who is listed: the
 * course's current students, plus anyone who already has a mark for the class (e.g. removed since).
 */
import { assertCan, Errors, type MarkAttendanceInput } from "@elearner/core";
import { AttendanceSource, ClassStatus } from "@elearner/db";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess, hasCourseAccess } from "../policies";
import { recordingConsentFor } from "./recording-consent";

async function managedClass(deps: Deps, actor: Actor, classId: string) {
  assertCan(actor.role, "attendance:write");
  const cls = await deps.db.classSession.findUnique({
    where: { id: classId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      status: true,
      hostId: true,
      location: true,
      meetLink: true,
      googleEventId: true,
      courseId: true,
      course: { select: { title: true, color: true } },
    },
  });
  const allowed =
    cls &&
    ((actor.role === "TEACHER" && cls.hostId === actor.id) ||
      (await hasCourseAccess(deps.db, actor, cls.courseId, "manage")));
  if (!cls || !allowed) throw Errors.notFound("Class");
  return cls;
}

export interface AttendanceSheetRow {
  userId: string;
  name: string;
  email: string;
  /** null: not marked yet. */
  present: boolean | null;
  source: AttendanceSource | null;
  minutes: number;
  /** Still in the course (false: removed after the class, but has a mark). */
  enrolled: boolean;
  /** Has agreed to the current class-recording notice. */
  recordingConsent: boolean;
}

export interface AttendanceSheet {
  class: {
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    status: ClassStatus;
    courseId: string;
    courseTitle: string;
    location: string | null;
    online: boolean;
    fromGoogle: boolean;
    /** Marks can be saved once the class has started. */
    started: boolean;
  };
  rows: AttendanceSheetRow[];
  present: number;
  marked: number;
}

export async function getAttendanceSheet(
  deps: Deps,
  actor: Actor,
  classId: string,
): Promise<AttendanceSheet> {
  const cls = await managedClass(deps, actor, classId);
  const [enrollments, records] = await Promise.all([
    deps.db.enrollment.findMany({
      where: { courseId: cls.courseId, revokedAt: null, user: { deletedAt: null } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    deps.db.attendance.findMany({
      where: { classSessionId: cls.id },
      select: {
        present: true,
        source: true,
        durationSeconds: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);
  const byUser = new Map(records.map((r) => [r.user.id, r]));
  const consent = await recordingConsentFor(deps.db, [
    ...new Set([...enrollments.map((e) => e.user.id), ...records.map((r) => r.user.id)]),
  ]);
  const enrolled = new Set(enrollments.map((e) => e.user.id));
  const people = new Map(
    [...enrollments.map((e) => e.user), ...records.map((r) => r.user)].map((u) => [u.id, u]),
  );
  const rows: AttendanceSheetRow[] = [...people.values()]
    .map((u) => {
      const r = byUser.get(u.id);
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        present: r ? r.present : null,
        source: r?.source ?? null,
        minutes: r ? Math.round(r.durationSeconds / 60) : 0,
        enrolled: enrolled.has(u.id),
        recordingConsent: consent.get(u.id) === "agreed",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    class: {
      id: cls.id,
      title: cls.title,
      startsAt: cls.startsAt,
      endsAt: cls.endsAt,
      status: cls.status,
      courseId: cls.courseId,
      courseTitle: cls.course.title,
      location: cls.location,
      online: cls.meetLink !== null,
      fromGoogle: cls.googleEventId !== null,
      started: cls.startsAt <= deps.now(),
    },
    rows,
    present: rows.filter((r) => r.present === true).length,
    marked: rows.filter((r) => r.present !== null).length,
  };
}

/** Save the teacher's marks. Only for people in the course (or already marked for this class). */
export async function markAttendance(
  deps: Deps,
  actor: Actor,
  classId: string,
  input: MarkAttendanceInput,
): Promise<{ saved: number }> {
  const cls = await managedClass(deps, actor, classId);
  if (cls.status === ClassStatus.CANCELLED) throw Errors.conflict("This class was cancelled.");
  if (cls.startsAt > deps.now()) throw Errors.conflict("You can take attendance once the class has started.");

  const userIds = [...new Set(input.marks.map((m) => m.userId))];
  const [enrolled, marked] = await Promise.all([
    deps.db.enrollment.findMany({
      where: { courseId: cls.courseId, revokedAt: null, userId: { in: userIds } },
      select: { userId: true },
    }),
    deps.db.attendance.findMany({
      where: { classSessionId: cls.id, userId: { in: userIds } },
      select: { userId: true },
    }),
  ]);
  const allowed = new Set([...enrolled, ...marked].map((x) => x.userId));
  if (userIds.some((id) => !allowed.has(id)))
    throw Errors.validation("Some of these people aren't in this course.");

  const last = new Map(input.marks.map((m) => [m.userId, m.present])); // a later mark for the same person wins
  await deps.db.$transaction(
    [...last].map(([userId, present]) =>
      deps.db.attendance.upsert({
        where: { classSessionId_userId: { classSessionId: cls.id, userId } },
        create: {
          classSessionId: cls.id,
          userId,
          present,
          source: AttendanceSource.MANUAL,
          markedById: actor.id,
        },
        update: { present, source: AttendanceSource.MANUAL, markedById: actor.id },
      }),
    ),
  );
  await audit(deps.db, actor, "attendance.mark", { type: "ClassSession", id: cls.id }, { count: last.size });
  return { saved: last.size };
}

export interface RecentClass {
  id: string;
  title: string;
  startsAt: Date;
  present: number;
  marked: number;
}

/** A course's latest classes that have started, with how many students are marked (course page). */
export async function recentClasses(
  deps: Deps,
  actor: Actor,
  courseId: string,
  take = 8,
): Promise<{ classes: RecentClass[]; students: number }> {
  assertCan(actor.role, "attendance:write");
  await assertCourseAccess(deps.db, actor, courseId, "manage");
  const [classes, students] = await Promise.all([
    deps.db.classSession.findMany({
      where: { courseId, status: { not: ClassStatus.CANCELLED }, startsAt: { lte: deps.now() } },
      select: {
        id: true,
        title: true,
        startsAt: true,
        attendances: { select: { present: true } },
      },
      orderBy: { startsAt: "desc" },
      take,
    }),
    deps.db.enrollment.count({ where: { courseId, revokedAt: null } }),
  ]);
  return {
    students,
    classes: classes.map((c) => ({
      id: c.id,
      title: c.title,
      startsAt: c.startsAt,
      present: c.attendances.filter((a) => a.present).length,
      marked: c.attendances.length,
    })),
  };
}
