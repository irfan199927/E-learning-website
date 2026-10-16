import { describe, expect, it } from "vitest";
import { makeDeps, world } from "@/test/fakes";
import { getCourseDetail, getLearnerOverview, getStreak, listMyCourses } from "./learning";
import { saveProgress } from "./videos";

async function addVideos(w: Awaited<ReturnType<typeof world>>, statuses: ("READY" | "TRANSCODING")[]) {
  const db = makeDeps().db;
  const out = [];
  for (const [i, status] of statuses.entries()) {
    out.push(
      await db.video.create({
        data: {
          title: `Lesson ${i + 1}`,
          source: "UPLOAD",
          status,
          uploaderId: w.teacher.id,
          courseId: w.course.id,
          durationSeconds: 600,
          createdAt: new Date(Date.UTC(2026, 0, 1 + i)),
        },
      }),
    );
  }
  return out;
}

describe("learning service (integration)", () => {
  it("builds course cards with progress and the lesson to open next", async () => {
    const w = await world();
    const [v1, v2, v3] = await addVideos(w, ["READY", "READY", "READY", "TRANSCODING"]);
    const deps = makeDeps();

    let [card] = await listMyCourses(deps, w.student);
    expect(card).toMatchObject({ lessonCount: 3, completedCount: 0, state: "not-started", percent: 0 });
    expect(card!.next).toEqual({ videoId: v1!.id, title: "Lesson 1", resume: false });

    await saveProgress(deps, w.student, v1!.id, { positionSeconds: 600, watchedDeltaSeconds: 60 });
    await saveProgress(deps, w.student, v2!.id, { positionSeconds: 120, watchedDeltaSeconds: 60 });
    [card] = await listMyCourses(deps, w.student);
    expect(card).toMatchObject({ completedCount: 1, state: "in-progress", percent: 33 });
    expect(card!.next).toEqual({ videoId: v2!.id, title: "Lesson 2", resume: true });

    for (const v of [v2!, v3!]) {
      await saveProgress(deps, w.student, v.id, { positionSeconds: 600, watchedDeltaSeconds: 0 });
    }
    [card] = await listMyCourses(deps, w.student);
    expect(card).toMatchObject({ state: "completed", percent: 100, next: null });

    // Outsiders and parents get nothing; the teacher sees their course with its students.
    expect(await listMyCourses(deps, w.outsider)).toEqual([]);
    expect(await listMyCourses(deps, w.parent)).toEqual([]);
    expect((await listMyCourses(deps, w.teacher))[0]).toMatchObject({ id: w.course.id, studentCount: 1 });
  });

  it("rolls watch time into the learner's local day and counts the streak", async () => {
    const w = await world();
    const [v1] = await addVideos(w, ["READY"]);
    // 20:00 UTC on 15 Oct = 01:30 on 16 Oct in India.
    const at = (iso: string) => makeDeps({ now: () => new Date(iso) });

    await saveProgress(at("2026-10-14T06:00:00Z"), w.student, v1!.id, {
      positionSeconds: 30,
      watchedDeltaSeconds: 30,
    });
    await saveProgress(at("2026-10-15T20:00:00Z"), w.student, v1!.id, {
      positionSeconds: 90,
      watchedDeltaSeconds: 60,
    });
    await saveProgress(at("2026-10-15T21:00:00Z"), w.student, v1!.id, {
      positionSeconds: 180,
      watchedDeltaSeconds: 90,
    });

    const o = await getLearnerOverview(at("2026-10-16T10:00:00Z"), w.student);
    expect(o.today).toBe("2026-10-16");
    expect(o.todaySeconds).toBe(150);
    expect(o.streak).toBe(1); // the 15th (IST) had no activity, so the 14th doesn't count
    expect(await getStreak(at("2026-10-16T10:00:00Z"), w.student)).toBe(1);
    expect(await getStreak(at("2026-10-16T10:00:00Z"), w.teacher)).toBeNull();
    expect(o.month.ym).toBe("2026-10");
    expect(o.month.next).toBeNull();
    expect(o.month.activeDays).toBe(2);
    const cells = o.month.weeks.flat().filter((c) => c !== null);
    expect(cells.find((c) => c.key === "2026-10-14")?.seconds).toBe(30);
    expect(cells.find((c) => c.key === "2026-10-17")?.isFuture).toBe(true);
    expect(o.resume?.next).toMatchObject({ videoId: v1!.id, resume: true });

    // Past months are browsable; future months and junk fall back to this month.
    const sept = await getLearnerOverview(at("2026-10-16T10:00:00Z"), w.student, { month: "2026-09" });
    expect(sept.month).toMatchObject({ ym: "2026-09", next: "2026-10", activeDays: 0 });
    for (const month of ["2027-01", "nope"]) {
      expect((await getLearnerOverview(at("2026-10-16T10:00:00Z"), w.student, { month })).month.ym).toBe(
        "2026-10",
      );
    }
    await expect(getLearnerOverview(makeDeps(), w.teacher)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("shows students only ready lessons, staff everything, and hides the course from others", async () => {
    const w = await world();
    await addVideos(w, ["READY", "TRANSCODING"]);
    const deps = makeDeps();

    const asStudent = await getCourseDetail(deps, w.student, w.course.id);
    expect(asStudent.canManage).toBe(false);
    expect(asStudent.lessons.map((l) => l.title)).toEqual(["Lesson 1"]);

    const asTeacher = await getCourseDetail(deps, w.teacher, w.course.id);
    expect(asTeacher.canManage).toBe(true);
    expect(asTeacher.lessons.map((l) => l.status)).toEqual(["READY", "TRANSCODING"]);
    expect(asTeacher.lessonCount).toBe(1);

    for (const actor of [w.outsider, w.parent, w.otherTeacher]) {
      await expect(getCourseDetail(deps, actor, w.course.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });
});
