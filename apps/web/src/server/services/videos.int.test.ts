import { describe, expect, it } from "vitest";
import { fakeJobs, fakeStorage, makeDeps, world } from "@/test/fakes";
import { completeUpload, getHlsFile, getPlayerData, initUpload, presignParts, saveProgress } from "./videos";

const MASTER = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360\n360p/index.m3u8\n";
const VARIANT =
  "#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6.0,\nseg_000.ts\n#EXTINF:6.0,\nseg_001.ts\n#EXT-X-ENDLIST\n";

describe("videos service (integration)", () => {
  it("runs the full upload lifecycle and queues transcoding", async () => {
    const w = await world();
    const storage = fakeStorage();
    const jobs = fakeJobs();
    const deps = makeDeps({ storage, jobs });

    const init = await initUpload(deps, w.teacher, {
      courseId: w.course.id,
      title: "Lesson 1",
      fileName: "lesson.mp4",
      mimeType: "video/mp4",
      sizeBytes: 40 * 1024 * 1024,
    });
    expect(init.partCount).toBe(3);

    const { urls } = await presignParts(deps, w.teacher, init.videoId, [1, 2, 3]);
    expect(urls.map((u) => u.partNumber)).toEqual([1, 2, 3]);
    await expect(presignParts(deps, w.otherTeacher, init.videoId, [1])).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await completeUpload(deps, w.teacher, init.videoId, {
      parts: [1, 2, 3].map((n) => ({ partNumber: n, etag: `"e${n}"` })),
    });
    expect(jobs.log).toContain(`transcode:${init.videoId}`);
    expect((await deps.db.video.findUnique({ where: { id: init.videoId } }))?.status).toBe("UPLOADED");
    await expect(
      completeUpload(deps, w.teacher, init.videoId, { parts: [{ partNumber: 1, etag: "x" }] }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("enforces upload permissions and size limit", async () => {
    const w = await world();
    const deps = makeDeps({ config: { ...makeDeps().config, maxUploadBytes: 1000 } });
    const input = {
      courseId: w.course.id,
      title: "Big file",
      fileName: "a.mp4",
      mimeType: "video/mp4" as const,
      sizeBytes: 5000,
    };
    await expect(initUpload(deps, w.teacher, input)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(initUpload(deps, w.student, { ...input, sizeBytes: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(initUpload(deps, w.otherTeacher, { ...input, sizeBytes: 10 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("serves rewritten playlists only to enrolled users, and records progress", async () => {
    const w = await world();
    const deps0 = makeDeps();
    const video = await deps0.db.video.create({
      data: {
        title: "Ready",
        source: "UPLOAD",
        status: "READY",
        uploaderId: w.teacher.id,
        courseId: w.course.id,
        hlsPrefix: "videos/v/hls/",
        durationSeconds: 600,
      },
    });
    const storage = fakeStorage({
      "videos/v/hls/master.m3u8": MASTER,
      "videos/v/hls/360p/index.m3u8": VARIANT,
    });
    const deps = makeDeps({ storage });

    const master = await getHlsFile(deps, w.student, video.id, ["master.m3u8"]);
    expect(master.kind === "playlist" && master.body).toContain(
      `/api/v1/videos/${video.id}/hls/360p/index.m3u8`,
    );
    const variant = await getHlsFile(deps, w.student, video.id, ["360p", "index.m3u8"]);
    expect(variant.kind === "playlist" && variant.body).toContain(
      "https://storage.test/videos/v/hls/360p/seg_000.ts?ttl=3600",
    );

    await expect(getHlsFile(deps, w.outsider, video.id, ["master.m3u8"])).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(getHlsFile(deps, w.parent, video.id, ["master.m3u8"])).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getHlsFile(deps, w.student, video.id, ["..", "..", "secret"])).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await saveProgress(deps, w.student, video.id, { positionSeconds: 120, watchedDeltaSeconds: 15 });
    await saveProgress(deps, w.student, video.id, { positionSeconds: 135, watchedDeltaSeconds: 15 });
    const p = await getPlayerData(deps, w.student, video.id);
    expect(p.resumeAtSeconds).toBe(135);
    const row = await deps.db.videoProgress.findUnique({
      where: { userId_videoId: { userId: w.student.id, videoId: video.id } },
    });
    expect(row?.watchedSeconds).toBe(30);
    expect(
      (await saveProgress(deps, w.student, video.id, { positionSeconds: 590, watchedDeltaSeconds: 0 }))
        .completed,
    ).toBe(true);
  });
});
