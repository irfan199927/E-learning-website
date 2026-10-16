import { describe, expect, it } from "vitest";
import { fakeJobs, makeDeps, world } from "@/test/fakes";
import { getAttendanceSheet, markAttendance, recentClasses } from "./attendance";
import { cancelClass, getJoinUrl, listClasses, rescheduleClass, scheduleClass } from "./classes";
import { getChildProgress } from "./parents";

const inHours = (h: number) => new Date(Date.now() + h * 3600_000);

/** Google must never be touched for classes scheduled without it. */
const noGoogle = {
  googleFor: async () => {
    throw new Error("Google was called");
  },
};

describe("classes without Google and manual attendance (integration)", () => {
  it("schedules, reschedules and cancels classes without Google", async () => {
    const w = await world();
    const jobs = fakeJobs();
    const deps = makeDeps({ jobs, ...noGoogle });

    const series = await scheduleClass(deps, w.teacher, {
      courseId: w.course.id,
      title: "Lab",
      startsAt: inHours(24),
      endsAt: inHours(25),
      timezone: "Asia/Kolkata",
      notifyParents: true,
      meeting: "none",
      location: "Science lab",
      recurrence: {
        freq: "WEEKLY",
        byDay: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"],
        until: inHours(24 * 7),
      },
    });
    expect(series.length).toBeGreaterThanOrEqual(7);
    expect(series.every((c) => c.location === "Science lab" && !c.online && c.meetLink === null)).toBe(true);
    expect(jobs.log.filter((l) => l.startsWith("remind:"))).toHaveLength(series.length);

    const [online] = await scheduleClass(deps, w.teacher, {
      courseId: w.course.id,
      title: "Revision",
      startsAt: inHours(2),
      endsAt: inHours(3),
      timezone: "Asia/Kolkata",
      notifyParents: false,
      meeting: "none",
      meetingUrl: "https://meet.jit.si/elearner-revision",
    });
    expect(online).toMatchObject({ online: true, meetLink: "https://meet.jit.si/elearner-revision" });

    // Students see where it is; the pasted link opens like a Meet link, inside the join window.
    const asStudent = (await listClasses(deps, w.student, { from: inHours(0), to: inHours(30) })).find(
      (c) => c.id === series[0]!.id,
    );
    expect(asStudent).toMatchObject({ location: "Science lab", online: false, meetLink: null });
    await expect(getJoinUrl(deps, w.student, series[0]!.id)).rejects.toThrow("meets in person: Science lab");

    const moved = await rescheduleClass(deps, w.teacher, series[0]!.id, {
      startsAt: inHours(26),
      endsAt: inHours(27),
    });
    expect(new Date(moved.startsAt).getTime()).toBeCloseTo(inHours(26).getTime(), -4);
    await cancelClass(deps, w.teacher, online!.id);
    expect((await deps.db.classSession.findUnique({ where: { id: online!.id } }))?.status).toBe("CANCELLED");
  });

  it("lets the teacher take attendance once the class has started; the teacher's mark beats Meet", async () => {
    const w = await world();
    const deps = makeDeps(noGoogle);
    const mk = (startH: number) =>
      deps.db.classSession.create({
        data: {
          courseId: w.course.id,
          hostId: w.teacher.id,
          title: "Algebra",
          startsAt: inHours(startH),
          endsAt: inHours(startH + 1),
          status: startH < 0 ? "ENDED" : "SCHEDULED",
        },
      });
    const past = await mk(-3);
    const future = await mk(5);

    // Meet already recorded the student as absent; the teacher corrects it.
    await deps.db.attendance.create({
      data: { classSessionId: past.id, userId: w.student.id, present: false, source: "MEET_API" },
    });
    let sheet = await getAttendanceSheet(deps, w.teacher, past.id);
    expect(sheet.rows.map((r) => [r.userId, r.present, r.source])).toEqual([
      [w.student.id, false, "MEET_API"],
    ]);

    await markAttendance(deps, w.teacher, past.id, { marks: [{ userId: w.student.id, present: true }] });
    sheet = await getAttendanceSheet(deps, w.teacher, past.id);
    expect(sheet).toMatchObject({ present: 1, marked: 1 });
    expect(sheet.rows[0]).toMatchObject({ present: true, source: "MANUAL" });
    const row = await deps.db.attendance.findFirstOrThrow({ where: { classSessionId: past.id } });
    expect(row.markedById).toBe(w.teacher.id);

    // The parent sees the mark.
    const p = await getChildProgress(deps, w.parent, w.student.id);
    expect(p.attendance.rows.find((r) => r.classId === past.id)).toMatchObject({ present: true });

    // Guard rails.
    await expect(
      markAttendance(deps, w.teacher, future.id, { marks: [{ userId: w.student.id, present: true }] }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      markAttendance(deps, w.teacher, past.id, { marks: [{ userId: w.outsider.id, present: true }] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(getAttendanceSheet(deps, w.otherTeacher, past.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(getAttendanceSheet(deps, w.student, past.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await getAttendanceSheet(deps, w.admin, past.id)).marked).toBe(1);

    const recent = await recentClasses(deps, w.teacher, w.course.id);
    expect(recent.students).toBe(1);
    expect(recent.classes.map((c) => [c.id, c.present, c.marked])).toEqual([[past.id, 1, 1]]);
  });
});
