import { describe, expect, it } from "vitest";
import { addVideoLesson, makeDeps, world } from "@/test/fakes";
import { getChildProgress, linkChild, listChildren, unlinkChild } from "./parents";
import { saveProgress } from "./videos";

describe("parents (integration)", () => {
  it("shows a linked child's progress and class attendance, and nothing to anyone else", async () => {
    const w = await world();
    const deps = makeDeps();
    const { video } = await addVideoLesson(w, { title: "Lesson 1" });
    await addVideoLesson(w, { title: "Lesson 2" });
    await saveProgress(deps, w.student, video.id, { positionSeconds: 600, watchedDeltaSeconds: 300 });

    // Three past classes: attended, missed, nothing recorded; plus a cancelled one that doesn't count.
    const now = deps.now();
    const at = (h: number) => new Date(now.getTime() - h * 3600_000);
    const mk = (title: string, h: number, status: "ENDED" | "CANCELLED" = "ENDED") =>
      deps.db.classSession.create({
        data: {
          courseId: w.course.id,
          hostId: w.teacher.id,
          title,
          startsAt: at(h + 1),
          endsAt: at(h),
          status,
        },
      });
    const [attended, missed] = await Promise.all([mk("Algebra", 48), mk("Geometry", 24), mk("Revision", 2)]);
    await mk("Cancelled", 30, "CANCELLED");
    await deps.db.attendance.createMany({
      data: [
        {
          classSessionId: attended.id,
          userId: w.student.id,
          present: true,
          durationSeconds: 2400,
          source: "MEET_API",
        },
        { classSessionId: missed.id, userId: w.student.id, present: false, source: "MANUAL" },
      ],
    });

    const [summary] = await listChildren(deps, w.parent);
    expect(summary).toMatchObject({
      id: w.student.id,
      lessonsCompleted: 1,
      courseCount: 1,
      todaySeconds: 300,
    });

    const p = await getChildProgress(deps, w.parent, w.student.id);
    expect(p.child.id).toBe(w.student.id);
    expect(p.courses[0]).toMatchObject({ id: w.course.id, completedCount: 1, lessonCount: 2, percent: 50 });
    expect(p.attendance).toMatchObject({ attended: 1, recorded: 2 });
    expect(p.attendance.rows.map((r) => [r.title, r.present, r.minutes])).toEqual([
      ["Revision", null, 0],
      ["Geometry", false, 0],
      ["Algebra", true, 40],
    ]);

    // Other students, other roles and unverified links get NOT_FOUND; non-parents have no children.
    for (const [actor, id] of [
      [w.parent, w.outsider.id],
      [w.teacher, w.student.id],
      [w.student, w.student.id],
    ] as const)
      await expect(getChildProgress(deps, actor, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listChildren(deps, w.teacher)).toEqual([]);
    await deps.db.parentLink.updateMany({ where: { parentId: w.parent.id }, data: { verifiedAt: null } });
    expect(await listChildren(deps, w.parent)).toEqual([]);
    await expect(getChildProgress(deps, w.parent, w.student.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets admins link and unlink parents and students", async () => {
    const w = await world();
    const deps = makeDeps();
    const outsiderEmail = (await deps.db.user.findUniqueOrThrow({ where: { id: w.outsider.id } })).email;

    const link = await linkChild(deps, w.admin, w.parent.id, { studentEmail: outsiderEmail.toUpperCase() });
    expect(link).toMatchObject({ studentId: w.outsider.id });
    expect((await listChildren(deps, w.parent)).map((c) => c.id).sort()).toEqual(
      [w.student.id, w.outsider.id].sort(),
    );

    await expect(
      linkChild(deps, w.admin, w.teacher.id, { studentEmail: outsiderEmail }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      linkChild(deps, w.admin, w.parent.id, { studentEmail: "nobody@test.local" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      linkChild(deps, w.teacher, w.parent.id, { studentEmail: outsiderEmail }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await unlinkChild(deps, w.admin, link.id);
    expect((await listChildren(deps, w.parent)).map((c) => c.id)).toEqual([w.student.id]);
  });
});
