/**
 * ffmpeg/ffprobe helpers. Argument builders are pure (unit-tested); `run` executes them.
 * Input can be a local path or an https URL (a presigned GET — ffmpeg streams it with range requests).
 */
import { spawn } from "node:child_process";

export interface Rendition {
  name: string;
  width: number;
  height: number;
  videoKbps: number;
  audioKbps: number;
}

export const LADDER: Rendition[] = [
  { name: "360p", width: 640, height: 360, videoKbps: 800, audioKbps: 96 },
  { name: "720p", width: 1280, height: 720, videoKbps: 2800, audioKbps: 128 },
];

/** Never upscale: keep renditions at or below the source height (always at least the lowest). */
export function pickRenditions(sourceHeight: number | null, ladder = LADDER): Rendition[] {
  if (!sourceHeight) return ladder.slice(0, 1);
  const fit = ladder.filter((r) => r.height <= sourceHeight);
  return fit.length ? fit : ladder.slice(0, 1);
}

export const SEGMENT_SECONDS = 6;

export function buildHlsArgs(
  input: string,
  outDir: string,
  renditions: Rendition[],
  hasAudio: boolean,
): string[] {
  const n = renditions.length;
  const split = `[0:v]split=${n}${renditions.map((_, i) => `[v${i}]`).join("")}`;
  const scales = renditions.map(
    (r, i) =>
      `[v${i}]scale=w=${r.width}:h=${r.height}:force_original_aspect_ratio=decrease:force_divisible_by=2[v${i}o]`,
  );
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-filter_complex",
    [split, ...scales].join(";"),
  ];
  renditions.forEach((r, i) => {
    args.push(
      "-map",
      `[v${i}o]`,
      `-c:v:${i}`,
      "libx264",
      `-b:v:${i}`,
      `${r.videoKbps}k`,
      `-maxrate:v:${i}`,
      `${Math.round(r.videoKbps * 1.07)}k`,
      `-bufsize:v:${i}`,
      `${Math.round(r.videoKbps * 1.5)}k`,
    );
    if (hasAudio) args.push("-map", "0:a:0", `-c:a:${i}`, "aac", `-b:a:${i}`, `${r.audioKbps}k`, "-ac", "2");
  });
  args.push(
    "-preset",
    "veryfast",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    // Keyframe exactly every segment boundary so all renditions switch cleanly.
    "-force_key_frames",
    `expr:gte(t,n_forced*${SEGMENT_SECONDS})`,
    "-sc_threshold",
    "0",
    "-f",
    "hls",
    "-hls_time",
    String(SEGMENT_SECONDS),
    "-hls_playlist_type",
    "vod",
    "-hls_flags",
    "independent_segments",
    "-hls_segment_filename",
    `${outDir}/%v/seg_%03d.ts`,
    "-master_pl_name",
    "master.m3u8",
    "-var_stream_map",
    renditions.map((r, i) => (hasAudio ? `v:${i},a:${i},name:${r.name}` : `v:${i},name:${r.name}`)).join(" "),
    `${outDir}/%v/index.m3u8`,
  );
  return args;
}

export function buildThumbnailArgs(input: string, atSeconds: number, outFile: string): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    atSeconds.toFixed(2),
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    "scale=640:-2",
    "-q:v",
    "3",
    outFile,
  ];
}

export const PROBE_ARGS = (input: string) => [
  "-v",
  "error",
  "-print_format",
  "json",
  "-show_format",
  "-show_streams",
  input,
];

export interface ProbeResult {
  durationSeconds: number | null;
  height: number | null;
  hasAudio: boolean;
}

export function parseProbe(json: string): ProbeResult {
  const data = JSON.parse(json) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; height?: number }[];
  };
  const video = data.streams?.find((s) => s.codec_type === "video");
  const duration = Number(data.format?.duration);
  return {
    durationSeconds: Number.isFinite(duration) ? Math.round(duration) : null,
    height: video?.height ?? null,
    hasAudio: !!data.streams?.some((s) => s.codec_type === "audio"),
  };
}

/** Run a binary; resolves stdout, rejects with the tail of stderr. Killed after `timeoutMs`. */
export function run(bin: string, args: string[], timeoutMs = 6 * 3600_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err = (err + d.toString()).slice(-4000)));
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (e) => (clearTimeout(timer), reject(e)));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${bin} exited with ${code}: ${err.trim()}`));
    });
  });
}
