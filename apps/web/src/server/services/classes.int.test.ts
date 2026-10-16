import { randomUUID } from "node:crypto";
import { AppError } from "@elearner/core";
import { describe, expect, it } from "vitest";
import { fakeGoogle, fakeJobs, makeDeps, world } from "@/test/fakes";
import { cancelClass, getJoinUrl, listClasses, rescheduleClass, scheduleClass } from "./classes";

const inHours = (h: number) => new Date(Date.now() + h * 3600_000);
const range = { from: inHours(-24), to: inHours(24 * 30) };

describe("classes service (integration)", () => {
  it("schedules a class: Google event first, DB rows, reminders, audit", async () => {
    const w = await world();
    const google = fakeGoogle();
    const jobs = fakeJobs();
    const deps = makeDeps({ google, jobs });

    const [cls] = await scheduleClass(deps, w.teacher, {
      courseId: w.course.id,
      title: "Quadratics",
      startsAt: inHours(48),
      endsAt: inHours(48.75),
      timezone: "Asia/Kolkata",
      notifyParents: true,
    });

    expect(cls?.meetLink).toBe("https://meet.google.com/abc-defg-hij");
    const call = google.calls.createClassEvent?.[0]?.[0] as { attendeeEmails: string[] };
    expect(call.attendeeEmails).toEqual([w.student.email]); // only enrolled, active students
    expect(jobs.log.some((l) => l.startsWith(`remind:${cls!.id}`))).toBe(true);
    const audit = await deps.db.auditLog.findFirst({
      where: { action: "class.schedule", targetId: w.course.id },
    });
    expect(audit).not.toBeNull();
  });

  it("creates one row per occurrence for a weekly series", async () => {
    const w = await world();
    // Unique per run: (calendarId, eventId) is unique and the test DB is shared across runs.
    const series = `series-${randomUUID().slice(0, 8)}`;
    const google = fakeGoogle({
      createClassEvent: async (input) => ({
        eventId: series,
        etag: null,
        meetLink: "https://meet.google.com/xyz",
        conferenceId: "xyz",
        instances: [0, 7, 14].map((d) => ({
          eventId: `${series}_${d}`,
          startsAt: new Date(input.startsAt.getTime() + d * 86_400_000),
          endsAt: new Date(input.endsAt.getTime() + d * 86_400_000),
        })),
      }),
    });
    const out = await scheduleClass(makeDeps({ google }), w.teacher, {
      courseId: w.course.id,
      title: "Weekly",
      startsAt: inHours(24),
      endsAt: inHours(25),
      timezone: "Asia/Kolkata",
      notifyParents: false,
      recurrence: { freq: "WEEKLY", byDay: ["WE"], until: inHours(24 * 20) },
    });
    expect(out).toHaveLength(3);
    expect(new Set(out.map((c) => c.seriesId))).toEqual(new Set([series]));
  });

  it("only the course teacher can schedule", async () => {
    const w = await world();
    const deps = makeDeps();
    const input = {
      courseId: w.course.id,
      title: "X class",
      startsAt: inHours(5),
      endsAt: inHours(6),
      timezone: "Asia/Kolkata",
      notifyParents: true,
    };
    await expect(scheduleClass(deps, w.otherTeacher, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(scheduleClass(deps, w.student, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("compensates by deleting the Google event when the DB write fails", async () => {
    const w = await world();
    const google = fakeGoogle({
      createClassEvent: async (input) => ({
        eventId: "dup",
        etag: null,
        meetLink: "m",
        conferenceId: "c",
        // Same instance id twice violates the unique (calendarId, eventId) constraint.
        instances: [
          { eventId: "dup-inst", startsAt: input.startsAt, endsAt: input.endsAt },
          { eventId: "dup-inst", startsAt: input.startsAt, endsAt: input.endsAt },
        ],
      }),
    });
    await expect(
      scheduleClass(makeDeps({ google }), w.teacher, {
        courseId: w.course.id,
        title: "Boom",
        startsAt: inHours(3),
        endsAt: inHours(4),
        timezone: "UTC",
        notifyParents: false,
      }),
    ).rejects.toThrow();
    expect(google.calls.cancelEvent?.[0]).toEqual(["dup"]);
  });

  it("lists classes per role: student enrolled, parent via child, outsider nothing", async () => {
    const w = await world();
    const deps = makeDeps();
    await scheduleClass(deps, w.teacher, {
      courseId: w.course.id,
      title: "Visible",
      startsAt: inHours(10),
      endsAt: inHours(11),
      timezone: "UTC",
      notifyParents: true,
    });

    const forStudent = await listClasses(deps, w.student, { ...range, courseId: w.course.id });
    expect(forStudent).toHaveLength(1);
    expect(forStudent[0]?.meetLink).toBeNull(); // students never get the raw link
    expect(await listClasses(deps, w.parent, { ...range, courseId: w.course.id })).toHaveLength(1);
    expect(await listClasses(deps, w.outsider, { ...range, courseId: w.course.id })).toHaveLength(0);
    expect(
      (await listClasses(deps, w.teacher, { ...range, courseId: w.course.id }))[0]?.meetLink,
    ).toBeTruthy();
  });

  it("gates joining to the window and to enrolled users", async () => {
    const w = await world();
    const startsAt = inHours(1);
    const [cls] = await scheduleClass(makeDeps(), w.teacher, {
      courseId: w.course.id,
      title: "Soon",
      startsAt,
      endsAt: inHours(2),
      timezone: "UTC",
      notifyParents: false,
    });

    const early = makeDeps({ now: () => new Date(startsAt.getTime() - 30 * 60_000) });
    await expect(getJoinUrl(early, w.student, cls!.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const onTime = makeDeps({ now: () => new Date(startsAt.getTime() - 5 * 60_000) });
    await expect(getJoinUrl(onTime, w.student, cls!.id)).resolves.toMatch(/^https:\/\/meet\.google\.com/);
    await expect(getJoinUrl(onTime, w.outsider, cls!.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getJoinUrl(early, w.teacher, cls!.id)).resolves.toBeTruthy(); // host can open early
  });

  it("reschedules (Google + DB + reminders) and cancels", async () => {
    const w = await world();
    const google = fakeGoogle();
    const jobs = fakeJobs();
    const deps = makeDeps({ google, jobs });
    const [cls] = await scheduleClass(deps, w.teacher, {
      courseId: w.course.id,
      title: "Move me",
      startsAt: inHours(30),
      endsAt: inHours(31),
      timezone: "UTC",
      notifyParents: false,
    });

    const moved = await rescheduleClass(deps, w.teacher, cls!.id, {
      startsAt: inHours(54),
      endsAt: inHours(55),
    });
    expect(new Date(moved.startsAt).getTime()).toBeGreaterThan(new Date(cls!.startsAt).getTime());
    expect(google.calls.rescheduleEvent).toHaveLength(1);
    expect(jobs.log.some((l) => l.startsWith(`cancel:${cls!.id}`))).toBe(true);

    await expect(
      rescheduleClass(deps, w.otherTeacher, cls!.id, { startsAt: inHours(60), endsAt: inHours(61) }),
    ).rejects.toBeInstanceOf(AppError);

    await cancelClass(deps, w.teacher, cls!.id);
    expect((await deps.db.classSession.findUnique({ where: { id: cls!.id } }))?.status).toBe("CANCELLED");
    await expect(cancelClass(deps, w.teacher, cls!.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
