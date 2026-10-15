/**
 * Live classes: scheduling (Google Calendar + Meet), rescheduling, cancelling, listing,
 * time-gated joining and .ics export.
 *
 * Consistency rule: Google is called FIRST, then the DB is written. If the DB write fails
 * we compensate by deleting the Google event, so we never leave an orphan Meet invite
 * in 30 students' calendars without a matching class in the app.
 */
import { randomUUID } from "node:crypto";
import {
  assertCan,
  buildIcs,
  buildRRule,
  Errors,
  formatInZone,
  joinWindow,
  type CreateClassInput,
  type ListClassesQuery,
  type RescheduleClassInput,
} from "@elearner/core";
import { ClassStatus } from "@elearner/db";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess, visibleCoursesWhere } from "../policies";

export interface ClassDto {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: ClassStatus;
  seriesId: string | null;
  course: { id: string; title: string; color: string };
  /** Only for the class host/admin; students go through /join (time-gated). */
  meetLink: string | null;
  canManage: boolean;
}

const classInclude = { course: { select: { id: true, title: true, color: true, teacherId: true } } } as const;

type ClassRow = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: ClassStatus;
  seriesId: string | null;
  meetLink: string | null;
  hostId: string;
  course: { id: string; title: string; color: string; teacherId: string };
};

function toDto(row: ClassRow, actor: Actor): ClassDto {
  const canManage = actor.role === "ADMIN" || row.hostId === actor.id || row.course.teacherId === actor.id;
  return {
    id: row.id,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    seriesId: row.seriesId,
    course: { id: row.course.id, title: row.course.title, color: row.course.color },
    meetLink: canManage ? row.meetLink : null,
    canManage,
  };
}

export async function listClasses(deps: Deps, actor: Actor, q: ListClassesQuery): Promise<ClassDto[]> {
  assertCan(actor.role, "class:read");
  const rows = await deps.db.classSession.findMany({
    where: {
      startsAt: { lt: q.to },
      endsAt: { gt: q.from },
      status: { not: ClassStatus.CANCELLED },
      ...(q.courseId ? { courseId: q.courseId } : {}),
      course: visibleCoursesWhere(actor),
    },
    include: classInclude,
    orderBy: { startsAt: "asc" },
    take: 500,
  });
  return rows.map((r) => toDto(r, actor));
}

export async function scheduleClass(deps: Deps, actor: Actor, input: CreateClassInput): Promise<ClassDto[]> {
  assertCan(actor.role, "class:schedule");
  const now = deps.now();
  if (input.startsAt.getTime() < now.getTime() - 5 * 60_000)
    throw Errors.validation("Pick a start time in the future.");

  const course = await deps.db.course.findUnique({
    where: { id: input.courseId },
    select: { id: true, title: true, teacherId: true },
  });
  if (!course) throw Errors.notFound("Course");
  // The Meet/Calendar event is owned by the host's Google account, so only the course teacher can host.
  if (course.teacherId !== actor.id)
    throw Errors.forbidden("Only the course teacher can schedule its classes.");

  const students = await deps.db.enrollment.findMany({
    where: { courseId: course.id, revokedAt: null, user: { isActive: true, deletedAt: null } },
    select: { user: { select: { email: true } } },
  });

  const google = await deps.googleFor(actor.id);
  const rrule = input.recurrence ? buildRRule(input.recurrence) : undefined;
  const created = await google.createClassEvent({
    title: input.title,
    description: [input.agenda, `Course: ${course.title}`].filter(Boolean).join("\n\n"),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timeZone: input.timezone,
    rrule,
    attendeeEmails: students.map((s) => s.user.email),
    requestId: randomUUID(),
    appRef: `course_${course.id}`,
  });

  let sessions: ClassRow[];
  try {
    sessions = await deps.db.$transaction(
      created.instances.map((inst) =>
        deps.db.classSession.create({
          data: {
            courseId: course.id,
            hostId: actor.id,
            title: input.title,
            agenda: input.agenda,
            startsAt: inst.startsAt,
            endsAt: inst.endsAt,
            timezone: input.timezone,
            recurrenceRule: rrule,
            seriesId: rrule ? created.eventId : null,
            googleEventId: inst.eventId,
            googleEventEtag: created.etag,
            meetLink: created.meetLink,
            meetConferenceId: created.conferenceId,
            notifyParents: input.notifyParents,
          },
          include: classInclude,
        }),
      ),
    );
  } catch (err) {
    await google.cancelEvent(created.eventId).catch(() => undefined); // compensate; original error wins
    throw err;
  }

  await Promise.all(sessions.map((s) => deps.jobs.scheduleReminders(s.id, s.startsAt, now)));
  await audit(
    deps.db,
    actor,
    "class.schedule",
    { type: "Course", id: course.id },
    {
      sessions: sessions.length,
      seriesId: created.eventId,
    },
  );
  return sessions.map((s) => toDto(s, actor));
}

async function loadManageable(deps: Deps, actor: Actor, classId: string) {
  const session = await deps.db.classSession.findUnique({ where: { id: classId }, include: classInclude });
  if (!session) throw Errors.notFound("Class");
  if (!(actor.role === "ADMIN" || session.hostId === actor.id)) throw Errors.notFound("Class");
  if (session.status !== ClassStatus.SCHEDULED)
    throw Errors.conflict("Only upcoming classes can be changed.");
  if (!session.googleEventId) throw Errors.conflict("This class has no Google Calendar event.");
  return session;
}

export async function rescheduleClass(
  deps: Deps,
  actor: Actor,
  classId: string,
  input: RescheduleClassInput,
): Promise<ClassDto> {
  assertCan(actor.role, "class:schedule");
  const session = await loadManageable(deps, actor, classId);
  if (input.startsAt < deps.now()) throw Errors.validation("Pick a start time in the future.");

  const google = await deps.googleFor(session.hostId);
  const { etag } = await google.rescheduleEvent(
    session.googleEventId!,
    input.startsAt,
    input.endsAt,
    session.timezone,
  );
  const updated = await deps.db.classSession.update({
    where: { id: classId },
    data: { startsAt: input.startsAt, endsAt: input.endsAt, googleEventEtag: etag },
    include: classInclude,
  });
  await deps.jobs.cancelReminders(classId, session.startsAt);
  await deps.jobs.scheduleReminders(classId, input.startsAt, deps.now());
  await audit(
    deps.db,
    actor,
    "class.reschedule",
    { type: "ClassSession", id: classId },
    {
      from: session.startsAt.toISOString(),
      to: input.startsAt.toISOString(),
    },
  );
  return toDto(updated, actor);
}

export async function cancelClass(deps: Deps, actor: Actor, classId: string): Promise<void> {
  assertCan(actor.role, "class:schedule");
  const session = await loadManageable(deps, actor, classId);
  const google = await deps.googleFor(session.hostId);
  await google.cancelEvent(session.googleEventId!);
  await deps.db.classSession.update({ where: { id: classId }, data: { status: ClassStatus.CANCELLED } });
  await deps.jobs.cancelReminders(classId, session.startsAt);
  await audit(deps.db, actor, "class.cancel", { type: "ClassSession", id: classId });
}

/** Returns the Meet URL if the join window is open; otherwise explains when it opens. */
export async function getJoinUrl(deps: Deps, actor: Actor, classId: string): Promise<string> {
  assertCan(actor.role, "class:join");
  const session = await deps.db.classSession.findUnique({
    where: { id: classId },
    select: { courseId: true, startsAt: true, endsAt: true, status: true, meetLink: true, hostId: true },
  });
  if (!session) throw Errors.notFound("Class");
  await assertCourseAccess(deps.db, actor, session.courseId, "watch");
  if (session.status === ClassStatus.CANCELLED) throw Errors.conflict("This class was cancelled.");
  if (!session.meetLink) throw Errors.conflict("This class has no Meet link yet.");
  if (session.hostId === actor.id) return session.meetLink; // host can always open their own meeting

  const w = joinWindow(session.startsAt, session.endsAt, deps.now(), deps.config.joinOpensMinutesBefore);
  if (w.state === "ended")
    throw Errors.conflict("This class has ended. The recording will appear in the Library.");
  if (w.state === "not-yet")
    throw Errors.conflict(`You can join from ${formatInZone(w.opensAt, actor.timezone)}.`);
  return session.meetLink;
}

export async function exportIcs(deps: Deps, actor: Actor, q: ListClassesQuery): Promise<string> {
  const classes = await listClasses(deps, actor, q);
  return buildIcs(
    classes.map((c) => ({
      uid: `${c.id}@elearner`,
      title: `${c.title} · ${c.course.title}`,
      startsAt: new Date(c.startsAt),
      endsAt: new Date(c.endsAt),
      url: `${deps.config.appUrl}/dashboard`,
      location: "Google Meet (join from E-learner)",
      updatedAt: deps.now(),
    })),
    "E-learner classes",
  );
}
