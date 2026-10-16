import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { addVideoLesson, fakeStorage, makeDeps, world } from "@/test/fakes";
import {
  attachmentDownloadUrl,
  completeAttachment,
  createLesson,
  createModule,
  deleteAttachment,
  deleteLesson,
  deleteModule,
  getCourseOutline,
  initAttachmentUpload,
  updateCourse,
  updateLesson,
  updateModule,
} from "./course-content";
import { getCourseDetail, getLessonView, listMyCourses, setLessonDone } from "./learning";

describe("course content (integration)", () => {
  it("builds a course from modules and lessons that students see in order", async () => {
    const w = await world();
    const deps = makeDeps();

    const basics = await createModule(deps, w.teacher, w.course.id, { title: "Basics" });
    const practice = await createModule(deps, w.teacher, w.course.id, { title: "Practice" });
    const note = await createLesson(deps, w.teacher, basics.id, {
      type: "NOTE",
      title: "Read me first",
      body: "Welcome!",
    });
    const link = await createLesson(deps, w.teacher, basics.id, {
      type: "LINK",
      title: "Number line",
      url: "https://example.org/number-line",
    });
    const sheet = await createLesson(deps, w.teacher, practice.id, { type: "DOCUMENT", title: "Worksheet" });

    // Practice first, then the link above the note.
    await updateModule(deps, w.teacher, practice.id, { move: "up" });
    await updateLesson(deps, w.teacher, link.id, { move: "up" });
    let detail = await getCourseDetail(deps, w.student, w.course.id);
    expect(detail.modules.map((m) => [m.title, m.lessons.map((l) => l.title)])).toEqual([
      ["Practice", ["Worksheet"]],
      ["Basics", ["Number line", "Read me first"]],
    ]);
    expect(detail.lessonCount).toBe(3);

    // Hidden lessons disappear for students (and can't be opened), staff still see them.
    await updateLesson(deps, w.teacher, sheet.id, { published: false });
    detail = await getCourseDetail(deps, w.student, w.course.id);
    expect(detail.modules.map((m) => m.title)).toEqual(["Basics"]);
    await expect(getLessonView(deps, w.student, sheet.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const staffView = await getLessonView(deps, w.teacher, sheet.id);
    expect(staffView).toMatchObject({ hidden: true, canManage: true, number: null });

    // Prev / next follow course order, and ticking a lesson counts towards progress.
    const view = await getLessonView(deps, w.student, link.id);
    expect(view).toMatchObject({ number: 1, total: 2, prev: null, next: { id: note.id } });
    await setLessonDone(deps, w.student, link.id, true);
    const [card] = await listMyCourses(deps, w.student);
    expect(card).toMatchObject({ lessonCount: 2, completedCount: 1, percent: 50 });
    expect(card!.next).toMatchObject({ lessonId: note.id, resume: false });
    await setLessonDone(deps, w.student, link.id, false);
    expect((await getLessonView(deps, w.student, link.id)).completed).toBe(false);

    // Moving a lesson to another module puts it at the end there.
    await updateLesson(deps, w.teacher, note.id, { moduleId: practice.id });
    const outline = await getCourseOutline(deps, w.teacher, w.course.id);
    expect(outline.modules.map((m) => [m.title, m.lessons.map((l) => l.title)])).toEqual([
      ["Practice", ["Worksheet", "Read me first"]],
      ["Basics", ["Number line"]],
    ]);

    // Only empty modules can be deleted.
    await expect(deleteModule(deps, w.teacher, basics.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await deleteLesson(deps, w.teacher, link.id);
    await deleteModule(deps, w.teacher, basics.id);
    expect((await getCourseOutline(deps, w.teacher, w.course.id)).modules).toHaveLength(1);
  });

  it("keeps a deleted video lesson's video so it can be added back", async () => {
    const w = await world();
    const deps = makeDeps();
    const { video, lesson, moduleId } = await addVideoLesson(w, { title: "Recording" });

    await deleteLesson(deps, w.teacher, lesson.id);
    let outline = await getCourseOutline(deps, w.teacher, w.course.id);
    expect(outline.looseVideos.map((v) => v.id)).toEqual([video.id]);

    await createLesson(deps, w.teacher, moduleId, { type: "VIDEO", title: "Recording", videoId: video.id });
    outline = await getCourseOutline(deps, w.teacher, w.course.id);
    expect(outline.looseVideos).toEqual([]);
    await expect(
      createLesson(deps, w.teacher, moduleId, { type: "VIDEO", title: "Again", videoId: video.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("lets only the course's teacher or an admin edit", async () => {
    const w = await world();
    const deps = makeDeps();
    const mod = await createModule(deps, w.admin, w.course.id, { title: "By admin" });

    for (const actor of [w.otherTeacher]) {
      await expect(createModule(deps, actor, w.course.id, { title: "x" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(updateModule(deps, actor, mod.id, { title: "x" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        createLesson(deps, actor, mod.id, { type: "NOTE", title: "x", body: "x" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    await expect(updateCourse(deps, w.student, w.course.id, { title: "Hacked" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const updated = await updateCourse(deps, w.teacher, w.course.id, {
      title: "Algebra",
      grade: "",
      color: "#0F7B5F",
      listed: false,
    });
    expect(updated).toMatchObject({ title: "Algebra", grade: null, color: "#0F7B5F", listed: false });
    expect((await updateCourse(deps, w.teacher, w.course.id, { listed: true })).listed).toBe(true);
  });

  it("uploads attachments, serves them to enrolled students only, and deletes them", async () => {
    const w = await world();
    const storage = fakeStorage();
    const deps = makeDeps({ storage });
    const mod = await createModule(deps, w.teacher, w.course.id, { title: "Files" });
    const lesson = await createLesson(deps, w.teacher, mod.id, { type: "DOCUMENT", title: "Worksheets" });
    const file = { fileName: "Sheet 1 (Algebra).pdf", mimeType: "application/pdf" as const };

    const init = await initAttachmentUpload(deps, w.teacher, lesson.id, { ...file, sizeBytes: 2048 });
    expect(init.uploadUrl).toContain(`attachments/${lesson.id}/${init.attachmentId}/`);

    // Not uploaded yet → refused; then the object exists.
    await expect(
      completeAttachment(deps, w.teacher, lesson.id, { attachmentId: init.attachmentId, ...file }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const key = new URL(init.uploadUrl).pathname.slice(1);
    storage.sizes.set(key, 2048);
    const att = await completeAttachment(deps, w.teacher, lesson.id, {
      attachmentId: init.attachmentId,
      ...file,
    });
    expect(att).toMatchObject({ fileName: file.fileName, sizeBytes: 2048 });

    // Another lesson's id can't be used to claim this object.
    const other = await createLesson(deps, w.teacher, mod.id, { type: "DOCUMENT", title: "Other" });
    await expect(
      completeAttachment(deps, w.teacher, other.id, { attachmentId: randomUUID(), ...file }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const url = await attachmentDownloadUrl(deps, w.student, att.id);
    expect(decodeURIComponent(url)).toContain(key);
    for (const actor of [w.outsider, w.parent, w.otherTeacher])
      await expect(attachmentDownloadUrl(deps, actor, att.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await updateLesson(deps, w.teacher, lesson.id, { published: false });
    await expect(attachmentDownloadUrl(deps, w.student, att.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await expect(deleteAttachment(deps, w.otherTeacher, att.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await deleteAttachment(deps, w.teacher, att.id);
    expect(storage.deleted).toEqual([key]);
  });
});
