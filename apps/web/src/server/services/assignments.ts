/**
 * Assignments: a teacher sets work with a due date; students hand in a text answer and/or files; the teacher
 * grades with a score and feedback.
 *
 * - Students only see published assignments of courses they're enrolled in (NOT_FOUND otherwise).
 * - Handing in after the due date counts as LATE when the assignment allows it, and is refused otherwise.
 *   A student can hand in again until it's graded.
 * - Files go straight to storage (presigned PUT) under `submissions/<assignment>/<student>/`; a submission may only
 *   reference objects under the student's own prefix, and each must exist and be within the size limit.
 * - Grading notifies the student in the app and is audited (`grade.edit`, with the previous score).
 */
import { randomUUID } from "node:crypto";
import {
  assertCan,
  Errors,
  MAX_SUBMISSION_FILES,
  SUBMISSION_FILE_MAX_BYTES,
  submissionTiming,
  type CreateAssignmentInput,
  type GradeSubmissionInput,
  type InitSubmissionFileInput,
  type SubmitAssignmentInput,
  type UpdateAssignmentInput,
} from "@elearner/core";
import { SubmissionStatus } from "@elearner/db";
import { keys } from "@elearner/storage";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess, hasCourseAccess } from "../policies";
import { courseStudentIds, notifyUsers } from "./notifications";

/** Tell the course's students about newly visible work (once per assignment, however often it's re-published). */
async function announce(deps: Deps, courseId: string, id: string, title: string) {
  await notifyUsers(deps, await courseStudentIds(deps, courseId), {
    type: "assignment.published",
    title: `New assignment: ${title}`,
    body: "Open it to see the instructions and the due date.",
    link: `/assignments/${id}`,
    dedupeKey: `assignment_published_${id}`,
  });
}

/** Display name of a stored file: the last part of its key. */
export const fileNameOf = (key: string) => key.slice(key.lastIndexOf("/") + 1);

const assignmentSelect = {
  id: true,
  courseId: true,
  title: true,
  instructions: true,
  dueAt: true,
  maxPoints: true,
  allowText: true,
  allowFile: true,
  allowLate: true,
  publishedAt: true,
  createdAt: true,
  course: { select: { title: true } },
} as const;

/**
 * Load an assignment and decide what the actor may do with it. Students: published, and enrolled. Staff: manage
 * access to the course. Anyone else: NOT_FOUND.
 */
async function load(deps: Deps, actor: Actor, assignmentId: string) {
  const a = await deps.db.assignment.findUnique({ where: { id: assignmentId }, select: assignmentSelect });
  if (!a) throw Errors.notFound("Assignment");
  const manage = await hasCourseAccess(deps.db, actor, a.courseId, "manage");
  if (manage) return { a, manage: true };
  const student =
    actor.role === "STUDENT" &&
    a.publishedAt !== null &&
    (await hasCourseAccess(deps.db, actor, a.courseId, "watch"));
  if (!student) throw Errors.notFound("Assignment");
  return { a, manage: false };
}

export interface AssignmentSummary {
  id: string;
  title: string;
  dueAt: Date;
  maxPoints: number;
  published: boolean;
  /** Staff: how many handed in / graded. */
  counts: { submitted: number; graded: number } | null;
  /** Students: where they stand. */
  mine: { status: SubmissionStatus; score: number | null } | null;
}

/** A course's assignments, soonest due first. Staff see drafts too. */
export async function listCourseAssignments(
  deps: Deps,
  actor: Actor,
  courseId: string,
): Promise<AssignmentSummary[]> {
  await assertCourseAccess(deps.db, actor, courseId, "watch");
  const manage = await hasCourseAccess(deps.db, actor, courseId, "manage");
  const rows = await deps.db.assignment.findMany({
    where: { courseId, ...(manage ? {} : { publishedAt: { not: null } }) },
    select: {
      id: true,
      title: true,
      dueAt: true,
      maxPoints: true,
      publishedAt: true,
      submissions: manage
        ? { where: { status: { not: SubmissionStatus.DRAFT } }, select: { status: true, score: true } }
        : { where: { userId: actor.id }, select: { status: true, score: true } },
    },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    dueAt: r.dueAt,
    maxPoints: r.maxPoints,
    published: r.publishedAt !== null,
    counts: manage
      ? {
          submitted: r.submissions.length,
          graded: r.submissions.filter((s) => s.status === SubmissionStatus.GRADED).length,
        }
      : null,
    mine: manage ? null : (r.submissions[0] ?? null),
  }));
}

export async function createAssignment(
  deps: Deps,
  actor: Actor,
  courseId: string,
  input: CreateAssignmentInput,
): Promise<{ id: string }> {
  assertCan(actor.role, "course:manage");
  await assertCourseAccess(deps.db, actor, courseId, "manage");
  const a = await deps.db.assignment.create({
    data: {
      courseId,
      title: input.title,
      instructions: input.instructions,
      dueAt: input.dueAt,
      maxPoints: input.maxPoints,
      allowText: input.allowText,
      allowFile: input.allowFile,
      allowLate: input.allowLate,
      publishedAt: input.published ? deps.now() : null,
    },
    select: { id: true },
  });
  await audit(deps.db, actor, "assignment.create", { type: "Assignment", id: a.id });
  if (input.published) await announce(deps, courseId, a.id, input.title);
  return a;
}

export async function updateAssignment(
  deps: Deps,
  actor: Actor,
  assignmentId: string,
  input: UpdateAssignmentInput,
): Promise<{ id: string }> {
  assertCan(actor.role, "course:manage");
  const { a, manage } = await load(deps, actor, assignmentId);
  if (!manage) throw Errors.notFound("Assignment");
  const allowText = input.allowText ?? a.allowText;
  const allowFile = input.allowFile ?? a.allowFile;
  if (!allowText && !allowFile) throw Errors.validation("Allow a text answer, files, or both.");
  if (input.maxPoints !== undefined) {
    const over = await deps.db.submission.count({ where: { assignmentId, score: { gt: input.maxPoints } } });
    if (over)
      throw Errors.conflict("Some students already scored more than that. Change their grades first.");
  }
  await deps.db.assignment.update({
    where: { id: assignmentId },
    data: {
      title: input.title,
      instructions: input.instructions,
      dueAt: input.dueAt,
      maxPoints: input.maxPoints,
      allowText: input.allowText,
      allowFile: input.allowFile,
      allowLate: input.allowLate,
      ...(input.published === undefined
        ? {}
        : { publishedAt: input.published ? (a.publishedAt ?? deps.now()) : null }),
    },
  });
  await audit(deps.db, actor, "assignment.update", { type: "Assignment", id: assignmentId });
  if (input.published && !a.publishedAt)
    await announce(deps, a.courseId, assignmentId, input.title ?? a.title);
  return { id: assignmentId };
}

/** Deletes the assignment, every submission and the uploaded files. */
export async function deleteAssignment(deps: Deps, actor: Actor, assignmentId: string): Promise<void> {
  assertCan(actor.role, "course:manage");
  const { a, manage } = await load(deps, actor, assignmentId);
  if (!manage) throw Errors.notFound("Assignment");
  await deps.db.assignment.delete({ where: { id: assignmentId } });
  await deps.storage.deletePrefix(`submissions/${assignmentId}/`).catch(() => undefined);
  await audit(
    deps.db,
    actor,
    "assignment.delete",
    { type: "Assignment", id: assignmentId },
    { title: a.title },
  );
}

export interface SubmissionView {
  id: string;
  status: SubmissionStatus;
  text: string | null;
  /** `key` only in the student's own view (to keep files when handing in again). */
  files: { index: number; name: string; key?: string }[];
  submittedAt: Date | null;
  score: number | null;
  feedback: string | null;
  gradedAt: Date | null;
}

function toSubmissionView(
  s: {
    id: string;
    status: SubmissionStatus;
    text: string | null;
    fileKeys: string[];
    submittedAt: Date | null;
    score: number | null;
    feedback: string | null;
    gradedAt: Date | null;
  },
  own = false,
): SubmissionView {
  return {
    id: s.id,
    status: s.status,
    text: s.text,
    files: s.fileKeys.map((k, index) => ({ index, name: fileNameOf(k), ...(own ? { key: k } : {}) })),
    submittedAt: s.submittedAt,
    score: s.score,
    feedback: s.feedback,
    gradedAt: s.gradedAt,
  };
}

const submissionSelect = {
  id: true,
  status: true,
  text: true,
  fileKeys: true,
  submittedAt: true,
  score: true,
  feedback: true,
  gradedAt: true,
} as const;

export interface AssignmentView {
  assignment: {
    id: string;
    courseId: string;
    courseTitle: string;
    title: string;
    instructions: string;
    dueAt: Date;
    maxPoints: number;
    allowText: boolean;
    allowFile: boolean;
    allowLate: boolean;
    published: boolean;
  };
  canManage: boolean;
  /** Students: "on-time" | "late" | "closed" right now. */
  timing: "on-time" | "late" | "closed";
  /** Students: their own submission. */
  mine: SubmissionView | null;
  /** Staff: every current student, handed in or not. */
  roster: { userId: string; name: string; email: string; submission: SubmissionView | null }[] | null;
}

export async function getAssignment(deps: Deps, actor: Actor, assignmentId: string): Promise<AssignmentView> {
  const { a, manage } = await load(deps, actor, assignmentId);
  const base = {
    assignment: {
      id: a.id,
      courseId: a.courseId,
      courseTitle: a.course.title,
      title: a.title,
      instructions: a.instructions,
      dueAt: a.dueAt,
      maxPoints: a.maxPoints,
      allowText: a.allowText,
      allowFile: a.allowFile,
      allowLate: a.allowLate,
      published: a.publishedAt !== null,
    },
    canManage: manage,
    timing: submissionTiming(a.dueAt, deps.now(), a.allowLate),
  };
  if (!manage) {
    const mine = await deps.db.submission.findUnique({
      where: { assignmentId_userId: { assignmentId, userId: actor.id } },
      select: submissionSelect,
    });
    return { ...base, mine: mine ? toSubmissionView(mine, true) : null, roster: null };
  }
  const [enrolled, submissions] = await Promise.all([
    deps.db.enrollment.findMany({
      where: { courseId: a.courseId, revokedAt: null, user: { deletedAt: null } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    deps.db.submission.findMany({
      where: { assignmentId, status: { not: SubmissionStatus.DRAFT } },
      select: { ...submissionSelect, user: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  const byUser = new Map(submissions.map((s) => [s.user.id, s]));
  const people = new Map(
    [...enrolled.map((e) => e.user), ...submissions.map((s) => s.user)].map((u) => [u.id, u]),
  );
  return {
    ...base,
    mine: null,
    roster: [...people.values()]
      .sort((x, y) => x.name.localeCompare(y.name))
      .map((u) => {
        const s = byUser.get(u.id);
        return { userId: u.id, name: u.name, email: u.email, submission: s ? toSubmissionView(s) : null };
      }),
  };
}

async function loadForStudent(deps: Deps, actor: Actor, assignmentId: string) {
  if (actor.role !== "STUDENT") throw Errors.forbidden("Only students hand in assignments.");
  const { a } = await load(deps, actor, assignmentId);
  const timing = submissionTiming(a.dueAt, deps.now(), a.allowLate);
  if (timing === "closed")
    throw Errors.conflict("The due date has passed, and this assignment doesn't take late work.");
  return { a, timing };
}

/** Presigned upload for one file of the student's answer. */
export async function initSubmissionFile(
  deps: Deps,
  actor: Actor,
  assignmentId: string,
  input: InitSubmissionFileInput,
): Promise<{ fileKey: string; uploadUrl: string }> {
  const { a } = await loadForStudent(deps, actor, assignmentId);
  if (!a.allowFile) throw Errors.conflict("This assignment takes a text answer only.");
  const fileKey = keys.submission(a.id, actor.id, randomUUID(), input.fileName);
  return { fileKey, uploadUrl: await deps.storage.presignPut(fileKey, input.mimeType, 900) };
}

/** Hand in (or hand in again, until graded). */
export async function submitAssignment(
  deps: Deps,
  actor: Actor,
  assignmentId: string,
  input: SubmitAssignmentInput,
): Promise<SubmissionView> {
  const { a, timing } = await loadForStudent(deps, actor, assignmentId);
  const inputKeys = input.fileKeys ?? [];
  const text = a.allowText ? input.text || null : null;
  const fileKeys = a.allowFile ? [...new Set(inputKeys)] : [];
  if (!a.allowText && input.text) throw Errors.validation("This assignment takes files only.");
  if (!a.allowFile && inputKeys.length) throw Errors.validation("This assignment takes a text answer only.");
  if (!text && fileKeys.length === 0) throw Errors.validation("Write an answer or add a file first.");
  if (fileKeys.length > MAX_SUBMISSION_FILES)
    throw Errors.validation(`At most ${MAX_SUBMISSION_FILES} files.`);

  const prefix = keys.submissionPrefix(a.id, actor.id);
  for (const key of fileKeys) {
    if (!key.startsWith(prefix) || key.includes(".."))
      throw Errors.validation("One of the files isn't yours.");
    const head = await deps.storage.head(key);
    if (!head) throw Errors.validation(`${fileNameOf(key)} didn't finish uploading. Add it again.`);
    if (head.size > SUBMISSION_FILE_MAX_BYTES) {
      await deps.storage.deleteObject(key).catch(() => undefined);
      throw Errors.validation(
        `${fileNameOf(key)} is larger than ${SUBMISSION_FILE_MAX_BYTES / 1024 ** 2} MB.`,
      );
    }
  }

  const existing = await deps.db.submission.findUnique({
    where: { assignmentId_userId: { assignmentId, userId: actor.id } },
    select: { status: true, fileKeys: true },
  });
  if (existing?.status === SubmissionStatus.GRADED)
    throw Errors.conflict("Your teacher has already graded this. Ask them if you need to change it.");

  const status = timing === "late" ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED;
  const saved = await deps.db.submission.upsert({
    where: { assignmentId_userId: { assignmentId, userId: actor.id } },
    create: { assignmentId, userId: actor.id, text, fileKeys, status, submittedAt: deps.now() },
    update: { text, fileKeys, status, submittedAt: deps.now() },
    select: submissionSelect,
  });
  // Files dropped from an earlier hand-in are deleted (best effort).
  const dropped = (existing?.fileKeys ?? []).filter((k) => !fileKeys.includes(k));
  await Promise.all(dropped.map((k) => deps.storage.deleteObject(k).catch(() => undefined)));
  await audit(deps.db, actor, "assignment.submit", { type: "Assignment", id: assignmentId }, { status });
  return toSubmissionView(saved, true);
}

/** Grade (or re-grade) a submission. Audited with the previous score. */
export async function gradeSubmission(
  deps: Deps,
  actor: Actor,
  submissionId: string,
  input: GradeSubmissionInput,
): Promise<SubmissionView> {
  assertCan(actor.role, "course:manage");
  const sub = await deps.db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      userId: true,
      score: true,
      status: true,
      assignment: { select: { id: true, courseId: true, title: true, maxPoints: true } },
    },
  });
  if (!sub || !(await hasCourseAccess(deps.db, actor, sub.assignment.courseId, "manage")))
    throw Errors.notFound("Submission");
  if (sub.status === SubmissionStatus.DRAFT) throw Errors.conflict("This hasn't been handed in yet.");
  if (input.score > sub.assignment.maxPoints)
    throw Errors.validation(`The score can be at most ${sub.assignment.maxPoints}.`);

  const saved = await deps.db.submission.update({
    where: { id: sub.id },
    data: {
      score: input.score,
      feedback: input.feedback || null,
      status: SubmissionStatus.GRADED,
      gradedById: actor.id,
      gradedAt: deps.now(),
    },
    select: submissionSelect,
  });
  await deps.db.notification.create({
    data: {
      userId: sub.userId,
      channel: "IN_APP",
      type: "assignment.graded",
      title: `${sub.assignment.title}: ${input.score}/${sub.assignment.maxPoints}`,
      body: input.feedback ? input.feedback.slice(0, 200) : "Your teacher graded your work.",
      link: `/assignments/${sub.assignment.id}`,
    },
  });
  await audit(
    deps.db,
    actor,
    "grade.edit",
    { type: "Submission", id: sub.id },
    { from: sub.score, to: input.score, max: sub.assignment.maxPoints },
  );
  return toSubmissionView(saved);
}

/** Download one file of a submission: its student, or the course's staff. */
export async function submissionFileUrl(
  deps: Deps,
  actor: Actor,
  submissionId: string,
  index: number,
): Promise<string> {
  const sub = await deps.db.submission.findUnique({
    where: { id: submissionId },
    select: { userId: true, fileKeys: true, assignment: { select: { courseId: true } } },
  });
  const allowed =
    sub &&
    (sub.userId === actor.id || (await hasCourseAccess(deps.db, actor, sub.assignment.courseId, "manage")));
  const key = allowed ? sub.fileKeys[index] : undefined;
  if (!key) throw Errors.notFound("File");
  const name = fileNameOf(key);
  return deps.storage.presignGet(key, 300, { contentDisposition: `attachment; filename="${name}"` });
}
