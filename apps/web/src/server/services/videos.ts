/**
 * Video library: resumable multipart upload (browser → storage direct), gated HLS
 * playback and watch progress. See ADR-0005 for why playlists are served by the API.
 */
import {
  assertCan,
  dayKeyToDate,
  Errors,
  isPlaylist,
  localDayKey,
  partCount,
  resolveHlsPath,
  rewritePlaylist,
  UPLOAD_PART_BYTES,
  type CompleteUploadInput,
  type InitUploadInput,
  type VideoProgressInput,
} from "@elearner/core";
import { LessonType, VideoSource, VideoStatus } from "@elearner/db";
import { extensionFor, keys } from "@elearner/storage";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess, hasCourseAccess } from "../policies";
import { addUploadLesson } from "./course-content";

export interface InitUploadResult {
  videoId: string;
  partSize: number;
  partCount: number;
}

export async function initUpload(
  deps: Deps,
  actor: Actor,
  input: InitUploadInput,
): Promise<InitUploadResult> {
  assertCan(actor.role, "video:upload");
  await assertCourseAccess(deps.db, actor, input.courseId, "manage");
  if (input.sizeBytes > deps.config.maxUploadBytes) {
    throw Errors.validation(
      `Videos can be at most ${Math.round(deps.config.maxUploadBytes / 1024 ** 3)} GB.`,
    );
  }
  const replacing = input.replaceLessonId
    ? await deps.db.lesson.findFirst({
        where: { id: input.replaceLessonId, type: LessonType.VIDEO, module: { courseId: input.courseId } },
        select: { id: true },
      })
    : null;
  if (input.replaceLessonId && !replacing) throw Errors.notFound("Lesson");
  const video = await deps.db.video.create({
    data: {
      replacesLessonId: replacing?.id ?? null,
      title: input.title,
      source: VideoSource.UPLOAD,
      status: VideoStatus.PENDING_UPLOAD,
      uploaderId: actor.id,
      courseId: input.courseId,
      mimeType: input.mimeType,
      sizeBytes: BigInt(input.sizeBytes),
    },
  });
  // A replacement keeps the lesson on its old video until the worker finishes this one (transcode.ts).
  if (!replacing) await addUploadLesson(deps, actor, input.courseId, video.id, input.title, input.moduleId);
  const rawKey = keys.videoRaw(video.id, extensionFor(input.mimeType));
  const uploadId = await deps.storage.createMultipart(rawKey, input.mimeType);
  await deps.db.video.update({ where: { id: video.id }, data: { rawKey, uploadId } });
  return { videoId: video.id, partSize: UPLOAD_PART_BYTES, partCount: partCount(input.sizeBytes) };
}

async function loadPendingUpload(deps: Deps, actor: Actor, videoId: string) {
  const video = await deps.db.video.findUnique({ where: { id: videoId } });
  if (!video || (video.uploaderId !== actor.id && actor.role !== "ADMIN")) throw Errors.notFound("Upload");
  if (video.status !== VideoStatus.PENDING_UPLOAD || !video.uploadId || !video.rawKey) {
    throw Errors.conflict("This upload is already finished.");
  }
  return video as typeof video & { uploadId: string; rawKey: string };
}

export async function presignParts(deps: Deps, actor: Actor, videoId: string, partNumbers: number[]) {
  const video = await loadPendingUpload(deps, actor, videoId);
  // Only the parts the declared size needs: more parts would let the file outgrow the size checked at init.
  const parts = partCount(Number(video.sizeBytes));
  if (partNumbers.some((n) => n < 1 || n > parts))
    throw Errors.validation(`Part numbers run from 1 to ${parts}.`);
  const urls = await Promise.all(
    partNumbers.map(async (n) => ({
      partNumber: n,
      url: await deps.storage.presignPart(video.rawKey, video.uploadId, n, 3600),
    })),
  );
  return { urls };
}

export async function completeUpload(deps: Deps, actor: Actor, videoId: string, input: CompleteUploadInput) {
  const video = await loadPendingUpload(deps, actor, videoId);
  await deps.storage.completeMultipart(video.rawKey, video.uploadId, input.parts);
  const head = await deps.storage.head(video.rawKey);
  if (!head) throw Errors.upstream("Storage", "Upload finished but the file is missing.");
  // The real size must match what was declared (and so checked against the limit) at init.
  if (head.size > Number(video.sizeBytes) || head.size > deps.config.maxUploadBytes) {
    await deps.storage.deleteObject(video.rawKey).catch(() => undefined);
    await deps.db.$transaction([
      deps.db.lesson.deleteMany({ where: { videoId } }),
      deps.db.video.update({
        where: { id: videoId },
        data: { status: VideoStatus.FAILED, uploadId: null, error: "Uploaded file is bigger than declared" },
      }),
    ]);
    throw Errors.validation("The uploaded file is bigger than the size given when the upload started.");
  }
  await deps.db.video.update({
    where: { id: videoId },
    data: { status: VideoStatus.UPLOADED, uploadId: null, sizeBytes: BigInt(head.size) },
  });
  await deps.jobs.enqueueTranscode(videoId);
  await audit(deps.db, actor, "video.upload", { type: "Video", id: videoId }, { bytes: head.size });
  return { videoId, status: VideoStatus.UPLOADED };
}

export async function abortUpload(deps: Deps, actor: Actor, videoId: string) {
  const video = await loadPendingUpload(deps, actor, videoId);
  await deps.storage.abortMultipart(video.rawKey, video.uploadId).catch(() => undefined);
  await deps.db.$transaction([
    deps.db.lesson.deleteMany({ where: { videoId } }), // the lesson initUpload added
    deps.db.video.update({
      where: { id: videoId },
      data: { status: VideoStatus.FAILED, uploadId: null, error: "Upload cancelled" },
    }),
  ]);
}

async function loadWatchable(deps: Deps, actor: Actor, videoId: string) {
  assertCan(actor.role, "video:watch");
  const video = await deps.db.video.findUnique({
    where: { id: videoId },
    include: { lesson: { select: { id: true, publishedAt: true } } },
  });
  if (!video) throw Errors.notFound("Video");
  await assertCourseAccess(deps.db, actor, video.courseId, "watch");
  // Students only see videos that are in a lesson the teacher hasn't hidden.
  if (
    (!video.lesson || !video.lesson.publishedAt) &&
    !(await hasCourseAccess(deps.db, actor, video.courseId, "manage"))
  )
    throw Errors.notFound("Video");
  return video;
}

export type HlsResponse = { kind: "playlist"; body: string } | { kind: "redirect"; url: string };

/**
 * Serve any file under the video's HLS prefix. Playlists are rewritten so that child
 * playlists route back through this endpoint and segments become presigned URLs.
 */
export async function getHlsFile(
  deps: Deps,
  actor: Actor,
  videoId: string,
  pathParts: string[],
): Promise<HlsResponse> {
  const video = await loadWatchable(deps, actor, videoId);
  if (video.status !== VideoStatus.READY || !video.hlsPrefix)
    throw Errors.conflict("This video is still processing.");

  let rel: string;
  try {
    rel = resolveHlsPath("", pathParts.join("/"));
  } catch {
    throw Errors.notFound("File");
  }
  // Segments must stay valid for a whole viewing session (plus slack for pausing).
  const ttl = Math.max(3600, (video.durationSeconds ?? 0) * 2 + 1800);

  if (!isPlaylist(rel))
    return { kind: "redirect", url: await deps.storage.presignGet(video.hlsPrefix + rel, ttl) };

  const text = await deps.storage.getText(video.hlsPrefix + rel).catch(() => {
    throw Errors.notFound("File");
  });
  const targets = new Map<string, string>();
  for (const uri of collectUris(text)) {
    const target = resolveHlsPath(rel, uri);
    targets.set(
      uri,
      isPlaylist(target)
        ? `/api/v1/videos/${videoId}/hls/${target}`
        : await deps.storage.presignGet(video.hlsPrefix + target, ttl),
    );
  }
  return { kind: "playlist", body: rewritePlaylist(text, (uri) => targets.get(uri) ?? uri) };
}

function collectUris(playlist: string): string[] {
  const out = new Set<string>();
  rewritePlaylist(playlist, (uri) => {
    out.add(uri);
    return uri;
  });
  return [...out];
}

export async function getPlayerData(deps: Deps, actor: Actor, videoId: string) {
  const video = await loadWatchable(deps, actor, videoId);
  const progress = await deps.db.videoProgress.findUnique({
    where: { userId_videoId: { userId: actor.id, videoId } },
  });
  const course = await deps.db.course.findUnique({ where: { id: video.courseId }, select: { title: true } });
  return {
    id: video.id,
    title: video.title,
    courseId: video.courseId,
    courseTitle: course?.title ?? "",
    lessonId: video.lesson?.id ?? null,
    status: video.status,
    durationSeconds: video.durationSeconds,
    resumeAtSeconds: progress && !progress.completed ? progress.positionSeconds : 0,
    playlistUrl: `/api/v1/videos/${video.id}/hls/master.m3u8`,
    posterUrl: video.thumbnailKey ? await deps.storage.presignGet(video.thumbnailKey, 3600) : null,
  };
}

export async function saveProgress(deps: Deps, actor: Actor, videoId: string, input: VideoProgressInput) {
  const video = await loadWatchable(deps, actor, videoId);
  const nearEnd = video.durationSeconds ? input.positionSeconds >= video.durationSeconds * 0.95 : false;
  const completed = input.completed === true || nearEnd;
  await deps.db.videoProgress.upsert({
    where: { userId_videoId: { userId: actor.id, videoId } },
    create: {
      userId: actor.id,
      videoId,
      positionSeconds: input.positionSeconds,
      watchedSeconds: input.watchedDeltaSeconds,
      completed,
    },
    update: {
      positionSeconds: input.positionSeconds,
      watchedSeconds: { increment: input.watchedDeltaSeconds },
      ...(completed ? { completed: true } : {}),
    },
  });
  if (input.watchedDeltaSeconds > 0) {
    // Daily rollup for streaks and the activity calendar, keyed on the learner's own date.
    const day = dayKeyToDate(localDayKey(deps.now(), actor.timezone));
    await deps.db.learningDay.upsert({
      where: { userId_day: { userId: actor.id, day } },
      create: { userId: actor.id, day, watchedSeconds: input.watchedDeltaSeconds },
      update: { watchedSeconds: { increment: input.watchedDeltaSeconds } },
    });
  }
  return { completed };
}
