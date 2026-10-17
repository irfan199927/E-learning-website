import { describe, expect, it } from "vitest";
import { addVideoLesson, makeDeps, world } from "@/test/fakes";
import { createLesson, createModule, getLessonForEditing, reorderLessons } from "./course-content";
import { initUpload } from "./videos";

describe("content authoring (integration)", () => {
  it("reorders a module's lessons from a full list, and refuses stale lists", async () => {
    const w = await world();
    const deps = makeDeps();
    const mod = await createModule(deps, w.teacher, w.course.id, { title: "Week 1" });
    const mk = (title: string) => createLesson(deps, w.teacher, mod.id, { type: "NOTE", title, body: "x" });
    const [a, b, c] = [await mk("A"), await mk("B"), await mk("C")];

    await reorderLessons(deps, w.teacher, mod.id, { lessonIds: [c.id, a.id, b.id] });
    const order = await deps.db.lesson.findMany({
      where: { moduleId: mod.id },
      orderBy: { position: "asc" },
      select: { title: true },
    });
    expect(order.map((l) => l.title)).toEqual(["C", "A", "B"]);

    await expect(reorderLessons(deps, w.teacher, mod.id, { lessonIds: [a.id, b.id] })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(
      reorderLessons(deps, w.teacher, mod.id, { lessonIds: [a.id, a.id, b.id] }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      reorderLessons(deps, w.otherTeacher, mod.id, { lessonIds: [a.id, b.id, c.id] }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("uploads a replacement video without touching the lesson until it's processed", async () => {
    const w = await world();
    const deps = makeDeps();
    const { lesson, video } = await addVideoLesson(w, { title: "Intro" });
    const lessonsBefore = await deps.db.lesson.count({ where: { module: { courseId: w.course.id } } });

    const res = await initUpload(deps, w.teacher, {
      courseId: w.course.id,
      title: "Intro (new take)",
      fileName: "intro.mp4",
      mimeType: "video/mp4",
      sizeBytes: 10_000_000,
      replaceLessonId: lesson.id,
    });
    const created = await deps.db.video.findUniqueOrThrow({ where: { id: res.videoId } });
    expect(created.replacesLessonId).toBe(lesson.id);
    expect(await deps.db.lesson.count({ where: { module: { courseId: w.course.id } } })).toBe(lessonsBefore);
    expect((await deps.db.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).videoId).toBe(video.id);
    expect((await getLessonForEditing(deps, w.teacher, lesson.id)).replacement).toMatchObject({
      id: res.videoId,
      status: "PENDING_UPLOAD",
    });

    // Only video lessons of the same course can be replaced.
    const mod = await createModule(deps, w.teacher, w.course.id, { title: "Notes" });
    const note = await createLesson(deps, w.teacher, mod.id, { type: "NOTE", title: "Read me", body: "x" });
    await expect(
      initUpload(deps, w.teacher, {
        courseId: w.course.id,
        title: "Nope",
        fileName: "x.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1000,
        replaceLessonId: note.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
