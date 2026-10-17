/**
 * Course cover images (optional; the generated CourseTile is the fallback).
 *
 * - Upload: the teacher's browser PUTs the image straight to storage (presigned, 15 min), then calls complete.
 *   The key is rebuilt from the course and a fresh id, so a caller can't point the cover at another object; the
 *   real size is checked, and the previous cover is deleted.
 * - Display: `/api/v1/courses/:id/cover?v=<version>` redirects to a short-lived signed URL. Anyone signed in may
 *   see a published course's cover (the catalog shows them); drafts only to staff who manage the course.
 */
import { randomUUID } from "node:crypto";
import {
  assertCan,
  COVER_MAX_BYTES,
  COVER_MIME_TYPES,
  Errors,
  type CompleteCoverInput,
  type InitCoverInput,
} from "@elearner/core";
import { keys } from "@elearner/storage";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess, hasCourseAccess } from "../policies";

/** Cache-busting version for a cover URL: the upload id in the key (changes with every upload). */
export function coverVersion(coverKey: string | null): string | null {
  return coverKey ? (coverKey.split("/").pop()?.split(".")[0] ?? null) : null;
}

async function assertManages(deps: Deps, actor: Actor, courseId: string) {
  assertCan(actor.role, "course:manage");
  await assertCourseAccess(deps.db, actor, courseId, "manage");
}

export async function initCoverUpload(
  deps: Deps,
  actor: Actor,
  courseId: string,
  input: InitCoverInput,
): Promise<{ coverId: string; uploadUrl: string }> {
  await assertManages(deps, actor, courseId);
  const coverId = randomUUID();
  const key = keys.courseCover(courseId, coverId, COVER_MIME_TYPES[input.mimeType]);
  return { coverId, uploadUrl: await deps.storage.presignPut(key, input.mimeType, 900) };
}

export async function completeCoverUpload(
  deps: Deps,
  actor: Actor,
  courseId: string,
  input: CompleteCoverInput,
): Promise<{ coverVersion: string }> {
  await assertManages(deps, actor, courseId);
  const key = keys.courseCover(courseId, input.coverId, COVER_MIME_TYPES[input.mimeType]);
  const head = await deps.storage.head(key);
  if (!head) throw Errors.validation("The upload didn't finish. Try again.");
  if (head.size > COVER_MAX_BYTES) {
    await deps.storage.deleteObject(key).catch(() => undefined);
    throw Errors.validation(`Cover images can be at most ${COVER_MAX_BYTES / 1024 ** 2} MB.`);
  }
  const before = await deps.db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { coverKey: true },
  });
  await deps.db.course.update({ where: { id: courseId }, data: { coverKey: key } });
  if (before.coverKey && before.coverKey !== key)
    await deps.storage.deleteObject(before.coverKey).catch(() => undefined);
  await audit(deps.db, actor, "course.cover", { type: "Course", id: courseId }, { action: "set" });
  return { coverVersion: coverVersion(key)! };
}

export async function removeCover(deps: Deps, actor: Actor, courseId: string): Promise<void> {
  await assertManages(deps, actor, courseId);
  const course = await deps.db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { coverKey: true },
  });
  if (!course.coverKey) return;
  await deps.db.course.update({ where: { id: courseId }, data: { coverKey: null } });
  await deps.storage.deleteObject(course.coverKey).catch(() => undefined);
  await audit(deps.db, actor, "course.cover", { type: "Course", id: courseId }, { action: "remove" });
}

/** A signed URL for the cover, or NOT_FOUND (no cover, or a draft course the actor doesn't manage). */
export async function coverUrl(deps: Deps, actor: Actor, courseId: string): Promise<string> {
  const course = await deps.db.course.findUnique({
    where: { id: courseId },
    select: { coverKey: true, publishedAt: true },
  });
  if (!course?.coverKey) throw Errors.notFound("Cover");
  if (!course.publishedAt && !(await hasCourseAccess(deps.db, actor, courseId, "manage")))
    throw Errors.notFound("Cover");
  return deps.storage.presignGet(course.coverKey, 3600);
}
