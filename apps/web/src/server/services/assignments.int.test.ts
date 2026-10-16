import { describe, expect, it } from "vitest";
import { fakeStorage, makeDeps, world } from "@/test/fakes";
import {
  createAssignment,
  deleteAssignment,
  getAssignment,
  gradeSubmission,
  initSubmissionFile,
  listCourseAssignments,
  submissionFileUrl,
  submitAssignment,
  updateAssignment,
} from "./assignments";
import { getChildProgress } from "./parents";

const inHours = (h: number) => new Date(Date.now() + h * 3600_000);
const base = {
  title: "Essay: my school",
  instructions: "Write 300 words.",
  maxPoints: 20,
  allowText: true,
  allowFile: true,
  allowLate: false,
  published: true,
};

describe("assignments (integration)", () => {
  it("runs the hand-in and grading loop with files", async () => {
    const w = await world();
    const storage = fakeStorage();
    const deps = makeDeps({ storage });
    const { id } = await createAssignment(deps, w.teacher, w.course.id, { ...base, dueAt: inHours(48) });

    // The student uploads a file (straight to storage) and hands in.
    const up = await initSubmissionFile(deps, w.student, id, {
      fileName: "essay.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
    });
    expect(up.fileKey).toContain(`submissions/${id}/${w.student.id}/`);
    storage.sizes.set(up.fileKey, 1000);
    const sub = await submitAssignment(deps, w.student, id, {
      text: "My school is…",
      fileKeys: [up.fileKey],
    });
    expect(sub).toMatchObject({ status: "SUBMITTED", files: [{ index: 0, name: "essay.pdf" }] });

    // A key outside the student's own prefix is refused.
    await expect(
      submitAssignment(deps, w.student, id, { fileKeys: [`submissions/${id}/${w.outsider.id}/x/a.pdf`] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    // The teacher sees everyone, grades, and the student is told.
    const asTeacher = await getAssignment(deps, w.teacher, id);
    expect(asTeacher.roster?.map((r) => [r.userId, r.submission?.status])).toEqual([
      [w.student.id, "SUBMITTED"],
    ]);
    await expect(gradeSubmission(deps, w.teacher, sub.id, { score: 25, feedback: "" })).rejects.toMatchObject(
      { code: "VALIDATION" },
    );
    const graded = await gradeSubmission(deps, w.teacher, sub.id, { score: 17, feedback: "Good structure." });
    expect(graded).toMatchObject({ status: "GRADED", score: 17 });
    const note = await deps.db.notification.findFirst({
      where: { userId: w.student.id, type: "assignment.graded" },
    });
    expect(note?.title).toContain("17/20");
    const log = await deps.db.auditLog.findFirst({ where: { action: "grade.edit", targetId: sub.id } });
    expect(log).not.toBeNull();
    // The parent sees the grade.
    const child = await getChildProgress(deps, w.parent, w.student.id);
    expect(child.grades).toEqual([expect.objectContaining({ kind: "assignment", id, score: 17, max: 20 })]);

    // Graded work can't be handed in again; the student sees their grade.
    await expect(submitAssignment(deps, w.student, id, { text: "v2" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const [summary] = await listCourseAssignments(deps, w.student, w.course.id);
    expect(summary).toMatchObject({ id, mine: { status: "GRADED", score: 17 }, counts: null });
    const [staffSummary] = await listCourseAssignments(deps, w.teacher, w.course.id);
    expect(staffSummary?.counts).toEqual({ submitted: 1, graded: 1 });

    // Files: the student and staff can download; others can't.
    expect(await submissionFileUrl(deps, w.student, sub.id, 0)).toContain("essay.pdf");
    expect(await submissionFileUrl(deps, w.teacher, sub.id, 0)).toContain("essay.pdf");
    await expect(submissionFileUrl(deps, w.outsider, sub.id, 0)).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Lowering max points below an existing score is refused; deleting removes everything.
    await expect(updateAssignment(deps, w.teacher, id, { maxPoints: 10 })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await deleteAssignment(deps, w.teacher, id);
    expect(storage.deleted).toContain(`submissions/${id}/*`);
  });

  it("applies the due date, drafts and access rules", async () => {
    const w = await world();
    const deps = makeDeps();
    const closed = await createAssignment(deps, w.teacher, w.course.id, { ...base, dueAt: inHours(-1) });
    const late = await createAssignment(deps, w.teacher, w.course.id, {
      ...base,
      dueAt: inHours(-1),
      allowLate: true,
      allowFile: false,
    });
    const draft = await createAssignment(deps, w.teacher, w.course.id, {
      ...base,
      dueAt: inHours(24),
      published: false,
    });

    await expect(submitAssignment(deps, w.student, closed.id, { text: "x" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect((await submitAssignment(deps, w.student, late.id, { text: "sorry" })).status).toBe("LATE");
    await expect(
      submitAssignment(deps, w.student, late.id, { text: "", fileKeys: [] }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    });

    // Drafts are staff-only; outsiders, parents and other teachers see nothing.
    await expect(getAssignment(deps, w.student, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listCourseAssignments(deps, w.student, w.course.id)).map((a) => a.id)).not.toContain(
      draft.id,
    );
    for (const actor of [w.outsider, w.parent, w.otherTeacher])
      await expect(getAssignment(deps, actor, late.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createAssignment(deps, w.student, w.course.id, { ...base, dueAt: inHours(1) }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
