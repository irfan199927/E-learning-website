/**
 * Raw upload → HLS (360p/720p ladder) + thumbnail → storage. Idempotent: re-running
 * overwrites the same keys. Runbook: docs/runbooks/transcode-failures.md
 */
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import type { TranscodeJob } from "@elearner/queue";
import { keys } from "@elearner/storage";
import type { JobContext } from "../context";
import { buildHlsArgs, buildThumbnailArgs, parseProbe, pickRenditions, PROBE_ARGS, run } from "../lib/ffmpeg";

const CONTENT_TYPES: Record<string, string> = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  m4s: "video/iso.segment",
  mp4: "video/mp4",
  jpg: "image/jpeg",
};

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

export interface TranscodeOptions {
  /** Override the input (tests pass a local file instead of a presigned URL). */
  inputOverride?: string;
}

export async function transcodeVideo(ctx: JobContext, job: TranscodeJob, opts: TranscodeOptions = {}) {
  const video = await ctx.db.video.findUnique({ where: { id: job.videoId } });
  if (!video) return { skipped: "video deleted" };
  if (video.status === "READY") return { skipped: "already ready" };
  if (!video.rawKey) throw new Error(`Video ${video.id} has no raw file`);

  await ctx.db.video.update({ where: { id: video.id }, data: { status: "TRANSCODING", error: null } });
  const work = await mkdtemp(join(ctx.config.tmpDir, `transcode-${video.id}-`));
  try {
    const input = opts.inputOverride ?? (await ctx.storage.presignGet(video.rawKey, 6 * 3600));
    const probe = parseProbe(await run(ctx.config.ffprobePath, PROBE_ARGS(input), 120_000));
    const renditions = pickRenditions(probe.height);

    const out = join(work, "hls");
    await mkdir(out, { recursive: true });
    for (const r of renditions) await mkdir(join(out, r.name), { recursive: true });
    await run(ctx.config.ffmpegPath, buildHlsArgs(input, out, renditions, probe.hasAudio));

    const thumb = join(work, "thumb.jpg");
    await run(
      ctx.config.ffmpegPath,
      buildThumbnailArgs(input, Math.max(1, (probe.durationSeconds ?? 10) * 0.1), thumb),
      120_000,
    );

    const prefix = keys.videoHlsPrefix(video.id);
    let files = 0;
    for await (const file of walk(out)) {
      const ext = file.split(".").pop() ?? "";
      await ctx.storage.putStream(
        prefix + relative(out, file),
        createReadStream(file),
        CONTENT_TYPES[ext] ?? "application/octet-stream",
      );
      files++;
    }
    const thumbKey = keys.videoThumb(video.id);
    await ctx.storage.putStream(thumbKey, createReadStream(thumb), "image/jpeg");

    await ctx.db.video.update({
      where: { id: video.id },
      data: {
        status: "READY",
        hlsPrefix: prefix,
        thumbnailKey: thumbKey,
        durationSeconds: probe.durationSeconds,
      },
    });
    ctx.log.info(
      { videoId: video.id, renditions: renditions.map((r) => r.name), files },
      "transcode complete",
    );
    return { renditions: renditions.map((r) => r.name), files, durationSeconds: probe.durationSeconds };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Called by the worker when the LAST attempt fails. */
export async function markTranscodeFailed(ctx: Pick<JobContext, "db">, videoId: string, error: string) {
  await ctx.db.video.updateMany({
    where: { id: videoId },
    data: { status: "FAILED", error: error.slice(0, 1000) },
  });
}
