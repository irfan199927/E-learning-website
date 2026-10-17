/**
 * Course editing for its teacher (or an admin): course details, modules, lessons and lesson attachments.
 *
 * - A course is a list of modules; each module is a list of lessons, both ordered by `position`.
 * - Lesson types: VIDEO (a course video; uploads and Meet recordings create these), NOTE (text), LINK (a web
 *   page) and DOCUMENT (files to download). Any lesson can carry attachments.
 * - Hidden lessons (`publishedAt` null) are only shown to staff. Video lessons appear for students once the video
 *   is READY.
 * - Deleting a video lesson keeps the video: it shows up under "Videos not in a lesson" and can be added again.
 * - Attachments upload straight to storage with a presigned PUT, then `completeAttachment` checks the object and
 *   records it. Downloads go through `attachmentDownloadUrl` (access check, then a short-lived presigned GET).
 */
import { randomUUID } from "node:crypto";
import {
  assertCan,
  ATTACHMENT_MAX_BYTES,
  Errors,
  MAX_ATTACHMENTS_PER_LESSON,
  type CompleteAttachmentInput,
  type CreateLessonInput,
  type CreateModuleInput,
  type InitAttachmentInput,
  type UpdateCourseInput,
  type UpdateLessonInput,
  type UpdateModuleInput,
} from "@elearner/core";
import { LessonType, VideoStatus, type Db } from "@elearner/db";
import { keys } from "@elearner/storage";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess, hasCourseAccess } from "../policies";
import { coverVersion } from "./course-cover";

/** Name of the module new uploads go into when the teacher didn't pick one. */
export const VIDEOS_MODULE_TITLE = "Videos";

async function assertManages(deps: Deps, actor: Actor, courseId: string) {
  assertCan(actor.role, "course:manage");
  await assertCourseAccess(deps.db, actor, courseId, "manage");
}

/** Load a module the actor manages; NOT_FOUND otherwise (no id leaks). */
async function managedModule(deps: Deps, actor: Actor, moduleId: string) {
  assertCan(actor.role, "course:manage");
  const mod = await deps.db.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true, title: true },
  });
  if (!mod || !(await hasCourseAccess(deps.db, actor, mod.courseId, "manage")))
    throw Errors.notFound("Module");
  return mod;
}

async function managedLesson(deps: Deps, actor: Actor, lessonId: string) {
  assertCan(actor.role, "course:manage");
  const lesson = await deps.db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      type: true,
      moduleId: true,
      videoId: true,
      publishedAt: true,
      module: { select: { courseId: true } },
    },
  });
  if (!lesson || !(await hasCourseAccess(deps.db, actor, lesson.module.courseId, "manage")))
    throw Errors.notFound("Lesson");
  return { ...lesson, courseId: lesson.module.courseId };
}

/**
 * Move one row up or down among its siblings, then renumber them 1..n (so gaps such as the recordings
 * module's 999 disappear the first time anything moves).
 */
async function moveAmong(
  siblings: { id: string }[],
  id: string,
  move: "up" | "down",
  write: (id: string, position: number) => Promise<unknown>,
) {
  const order = siblings.map((s) => s.id);
  const i = order.indexOf(id);
  const j = move === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j]!, order[i]!];
  await Promise.all(order.map((rowId, n) => write(rowId, n + 1)));
}

async function nextLessonPosition(db: Db, moduleId: string) {
  const last = await db.lesson.aggregate({ where: { moduleId }, _max: { position: true } });
  return (last._max.position ?? 0) + 1;
}

// ── Course details ──

export async function updateCourse(deps: Deps, actor: Actor, courseId: string, input: UpdateCourseInput) {
  await assertManages(deps, actor, courseId);
  const course = await deps.db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { publishedAt: true },
  });
  const listed =
    input.listed === undefined
      ? {}
      : { publishedAt: input.listed ? (course.publishedAt ?? deps.now()) : null };
  const updated = await deps.db.course.update({
    where: { id: courseId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.grade !== undefined ? { grade: input.grade || null } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...listed,
    },
    select: { id: true, title: true, grade: true, description: true, color: true, publishedAt: true },
  });
  await audit(deps.db, actor, "course.update", { type: "Course", id: courseId });
  return { ...updated, listed: updated.publishedAt !== null };
}

// ── The editor's view ──

export interface OutlineLesson {
  id: string;
  title: string;
  type: LessonType;
  published: boolean;
  video: { id: string; status: VideoStatus; durationSeconds: number | null } | null;
  attachmentCount: number;
}

export interface CourseOutline {
  course: {
    id: string;
    title: string;
    grade: string | null;
    description: string | null;
    color: string;
    listed: boolean;
    coverVersion: string | null;
    /** Paid courses: the price (set by an admin, services/payments.ts). */
    priceInPaise: number | null;
  };
  modules: { id: string; title: string; lessons: OutlineLesson[] }[];
  /** Course videos that aren't in any lesson (their lesson was deleted, or they predate lessons). */
  looseVideos: { id: string; title: string; status: VideoStatus }[];
}

export async function getCourseOutline(deps: Deps, actor: Actor, courseId: string): Promise<CourseOutline> {
  await assertManages(deps, actor, courseId);
  const course = await deps.db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      grade: true,
      description: true,
      color: true,
      publishedAt: true,
      coverKey: true,
      isPaid: true,
      priceInPaise: true,
      modules: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          lessons: {
            orderBy: [{ position: "asc" }, { id: "asc" }],
            select: {
              id: true,
              title: true,
              type: true,
              publishedAt: true,
              video: { select: { id: true, status: true, durationSeconds: true } },
              _count: { select: { attachments: true } },
            },
          },
        },
      },
      videos: {
        where: {
          lesson: null,
          status: { in: [VideoStatus.UPLOADED, VideoStatus.TRANSCODING, VideoStatus.READY] },
        },
        select: { id: true, title: true, status: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return {
    course: {
      id: course.id,
      title: course.title,
      grade: course.grade,
      description: course.description,
      color: course.color,
      listed: course.publishedAt !== null,
      coverVersion: coverVersion(course.coverKey),
      priceInPaise: course.isPaid ? course.priceInPaise : null,
    },
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        type: l.type,
        published: l.publishedAt !== null,
        video: l.video,
        attachmentCount: l._count.attachments,
      })),
    })),
    looseVideos: course.videos,
  };
}

// ── Modules ──

export async function createModule(deps: Deps, actor: Actor, courseId: string, input: CreateModuleInput) {
  await assertManages(deps, actor, courseId);
  const last = await deps.db.module.aggregate({ where: { courseId }, _max: { position: true } });
  const mod = await deps.db.module.create({
    data: { courseId, title: input.title, position: (last._max.position ?? 0) + 1 },
    select: { id: true, title: true },
  });
  await audit(deps.db, actor, "module.create", { type: "Module", id: mod.id });
  return mod;
}

export async function updateModule(deps: Deps, actor: Actor, moduleId: string, input: UpdateModuleInput) {
  const mod = await managedModule(deps, actor, moduleId);
  if (input.title !== undefined)
    await deps.db.module.update({ where: { id: mod.id }, data: { title: input.title } });
  if (input.move) {
    const siblings = await deps.db.module.findMany({
      where: { courseId: mod.courseId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    await deps.db.$transaction(async (tx) =>
      moveAmong(siblings, mod.id, input.move!, (id, position) =>
        tx.module.update({ where: { id }, data: { position } }),
      ),
    );
  }
  return { id: mod.id };
}

/** Only empty modules can be deleted, so nobody loses lessons by accident. */
export async function deleteModule(deps: Deps, actor: Actor, moduleId: string): Promise<void> {
  const mod = await managedModule(deps, actor, moduleId);
  const lessons = await deps.db.lesson.count({ where: { moduleId: mod.id } });
  if (lessons > 0) throw Errors.conflict("Move or delete this module's lessons first.");
  await deps.db.module.delete({ where: { id: mod.id } });
  await audit(deps.db, actor, "module.delete", { type: "Module", id: mod.id }, { title: mod.title });
}

// ── Lessons ──

export async function createLesson(deps: Deps, actor: Actor, moduleId: string, input: CreateLessonInput) {
  const mod = await managedModule(deps, actor, moduleId);
  if (input.type === "VIDEO") {
    const video = await deps.db.video.findFirst({
      where: { id: input.videoId, courseId: mod.courseId },
      select: { id: true, lesson: { select: { id: true } } },
    });
    if (!video) throw Errors.notFound("Video");
    if (video.lesson) throw Errors.conflict("That video is already a lesson.");
  }
  const lesson = await deps.db.lesson.create({
    data: {
      moduleId: mod.id,
      title: input.title,
      type: input.type,
      position: await nextLessonPosition(deps.db, mod.id),
      body: "body" in input ? input.body || null : null,
      url: input.type === "LINK" ? input.url : null,
      videoId: input.type === "VIDEO" ? input.videoId : null,
      publishedAt: deps.now(),
    },
    select: { id: true },
  });
  await audit(deps.db, actor, "lesson.create", { type: "Lesson", id: lesson.id }, { type: input.type });
  return lesson;
}

/**
 * Add the VIDEO lesson for a new upload: into `moduleId` if given (it must belong to the course), otherwise into
 * the course's "Videos" module, created at the end when missing. Called by `initUpload`.
 */
export async function addUploadLesson(
  deps: Deps,
  actor: Actor,
  courseId: string,
  videoId: string,
  title: string,
  moduleId: string | undefined,
) {
  let target = moduleId
    ? await deps.db.module.findFirst({ where: { id: moduleId, courseId }, select: { id: true } })
    : null;
  if (moduleId && !target) throw Errors.notFound("Module");
  target ??=
    (await deps.db.module.findFirst({
      where: { courseId, title: VIDEOS_MODULE_TITLE },
      orderBy: { position: "asc" },
      select: { id: true },
    })) ?? (await createModule(deps, actor, courseId, { title: VIDEOS_MODULE_TITLE }));
  return deps.db.lesson.create({
    data: {
      moduleId: target.id,
      title,
      type: LessonType.VIDEO,
      position: await nextLessonPosition(deps.db, target.id),
      videoId,
      publishedAt: deps.now(),
    },
    select: { id: true },
  });
}

export interface LessonForEditing {
  id: string;
  courseId: string;
  courseTitle: string;
  moduleId: string;
  title: string;
  type: LessonType;
  body: string | null;
  url: string | null;
  published: boolean;
  video: { id: string; title: string; status: VideoStatus } | null;
  attachments: { id: string; fileName: string; sizeBytes: number }[];
  modules: { id: string; title: string }[];
}

export async function getLessonForEditing(
  deps: Deps,
  actor: Actor,
  lessonId: string,
): Promise<LessonForEditing> {
  const { courseId } = await managedLesson(deps, actor, lessonId);
  const [lesson, modules] = await Promise.all([
    deps.db.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: {
        id: true,
        moduleId: true,
        title: true,
        type: true,
        body: true,
        url: true,
        publishedAt: true,
        video: { select: { id: true, title: true, status: true } },
        attachments: {
          orderBy: { createdAt: "asc" },
          select: { id: true, fileName: true, sizeBytes: true },
        },
        module: { select: { course: { select: { title: true } } } },
      },
    }),
    deps.db.module.findMany({
      where: { courseId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true, title: true },
    }),
  ]);
  return {
    id: lesson.id,
    courseId,
    courseTitle: lesson.module.course.title,
    moduleId: lesson.moduleId,
    title: lesson.title,
    type: lesson.type,
    body: lesson.body,
    url: lesson.url,
    published: lesson.publishedAt !== null,
    video: lesson.video,
    attachments: lesson.attachments,
    modules,
  };
}

export async function updateLesson(deps: Deps, actor: Actor, lessonId: string, input: UpdateLessonInput) {
  const lesson = await managedLesson(deps, actor, lessonId);
  if (input.url !== undefined && lesson.type !== LessonType.LINK)
    throw Errors.validation("Only link lessons have a web address.");

  let moduleId = lesson.moduleId;
  let position: number | undefined;
  if (input.moduleId && input.moduleId !== lesson.moduleId) {
    const target = await deps.db.module.findFirst({
      where: { id: input.moduleId, courseId: lesson.courseId },
      select: { id: true },
    });
    if (!target) throw Errors.notFound("Module");
    moduleId = target.id;
    position = await nextLessonPosition(deps.db, target.id); // moved lessons go to the end
  }

  await deps.db.lesson.update({
    where: { id: lesson.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body || null } : {}),
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(position !== undefined ? { moduleId, position } : {}),
      ...(input.published !== undefined
        ? { publishedAt: input.published ? (lesson.publishedAt ?? deps.now()) : null }
        : {}),
    },
  });
  if (input.move) {
    const siblings = await deps.db.lesson.findMany({
      where: { moduleId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    await deps.db.$transaction(async (tx) =>
      moveAmong(siblings, lesson.id, input.move!, (id, pos) =>
        tx.lesson.update({ where: { id }, data: { position: pos } }),
      ),
    );
  }
  await audit(deps.db, actor, "lesson.update", { type: "Lesson", id: lesson.id });
  return { id: lesson.id, moduleId };
}

/** Deletes the lesson and its attachments. A video lesson's video stays in the course. */
export async function deleteLesson(deps: Deps, actor: Actor, lessonId: string): Promise<void> {
  const lesson = await managedLesson(deps, actor, lessonId);
  const files = await deps.db.attachment.findMany({
    where: { lessonId: lesson.id },
    select: { storageKey: true },
  });
  await deps.db.lesson.delete({ where: { id: lesson.id } });
  // Best effort: an orphaned object is harmless (the bucket is private), a failed delete shouldn't block.
  await Promise.all(files.map((f) => deps.storage.deleteObject(f.storageKey).catch(() => undefined)));
  await audit(deps.db, actor, "lesson.delete", { type: "Lesson", id: lesson.id }, { title: lesson.title });
}

// ── Attachments ──

export async function initAttachmentUpload(
  deps: Deps,
  actor: Actor,
  lessonId: string,
  input: InitAttachmentInput,
): Promise<{ attachmentId: string; uploadUrl: string }> {
  const lesson = await managedLesson(deps, actor, lessonId);
  const count = await deps.db.attachment.count({ where: { lessonId: lesson.id } });
  if (count >= MAX_ATTACHMENTS_PER_LESSON)
    throw Errors.conflict(`A lesson can have at most ${MAX_ATTACHMENTS_PER_LESSON} files.`);
  const attachmentId = randomUUID();
  const key = keys.attachment(lesson.id, attachmentId, input.fileName);
  return { attachmentId, uploadUrl: await deps.storage.presignPut(key, input.mimeType, 900) };
}

/** Record an uploaded file. The key is rebuilt from the lesson and id, so callers can't point at other objects. */
export async function completeAttachment(
  deps: Deps,
  actor: Actor,
  lessonId: string,
  input: CompleteAttachmentInput,
) {
  const lesson = await managedLesson(deps, actor, lessonId);
  const key = keys.attachment(lesson.id, input.attachmentId, input.fileName);
  if (await deps.db.attachment.findUnique({ where: { id: input.attachmentId }, select: { id: true } }))
    throw Errors.conflict("This file is already attached.");
  const head = await deps.storage.head(key);
  if (!head) throw Errors.validation("The upload didn't finish. Try again.");
  if (head.size > ATTACHMENT_MAX_BYTES) {
    await deps.storage.deleteObject(key).catch(() => undefined);
    throw Errors.validation(`Files can be at most ${ATTACHMENT_MAX_BYTES / 1024 ** 2} MB.`);
  }
  const attachment = await deps.db.attachment.create({
    data: {
      id: input.attachmentId,
      lessonId: lesson.id,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: head.size,
      storageKey: key,
    },
    select: { id: true, fileName: true, sizeBytes: true },
  });
  await audit(deps.db, actor, "attachment.create", { type: "Attachment", id: attachment.id });
  return attachment;
}

export async function deleteAttachment(deps: Deps, actor: Actor, attachmentId: string): Promise<void> {
  const file = await deps.db.attachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, lessonId: true, storageKey: true },
  });
  if (!file) throw Errors.notFound("File");
  await managedLesson(deps, actor, file.lessonId).catch(() => {
    throw Errors.notFound("File");
  });
  await deps.db.attachment.delete({ where: { id: file.id } });
  await deps.storage.deleteObject(file.storageKey).catch(() => undefined);
  await audit(deps.db, actor, "attachment.delete", { type: "Attachment", id: file.id });
}

/** RFC 6266 header that forces a download and keeps non-ASCII file names. */
function downloadDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Staff, or enrolled students when the lesson is visible to them. */
export async function attachmentDownloadUrl(deps: Deps, actor: Actor, attachmentId: string): Promise<string> {
  const file = await deps.db.attachment.findUnique({
    where: { id: attachmentId },
    select: {
      fileName: true,
      storageKey: true,
      lesson: { select: { publishedAt: true, module: { select: { courseId: true } } } },
    },
  });
  if (!file) throw Errors.notFound("File");
  const courseId = file.lesson.module.courseId;
  const allowed =
    (await hasCourseAccess(deps.db, actor, courseId, "manage")) ||
    (file.lesson.publishedAt !== null &&
      actor.role === "STUDENT" &&
      (await hasCourseAccess(deps.db, actor, courseId, "watch")));
  if (!allowed) throw Errors.notFound("File");
  return deps.storage.presignGet(file.storageKey, 300, {
    contentDisposition: downloadDisposition(file.fileName),
  });
}
