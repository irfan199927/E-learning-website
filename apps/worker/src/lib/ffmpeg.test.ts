import { describe, expect, it } from "vitest";
import { buildHlsArgs, buildThumbnailArgs, LADDER, parseProbe, pickRenditions } from "./ffmpeg";

describe("ffmpeg args", () => {
  it("never upscales", () => {
    expect(pickRenditions(1080).map((r) => r.name)).toEqual(["360p", "720p"]);
    expect(pickRenditions(720).map((r) => r.name)).toEqual(["360p", "720p"]);
    expect(pickRenditions(480).map((r) => r.name)).toEqual(["360p"]);
    expect(pickRenditions(240).map((r) => r.name)).toEqual(["360p"]);
    expect(pickRenditions(null).map((r) => r.name)).toEqual(["360p"]);
  });

  it("builds a multi-rendition HLS command with aligned keyframes", () => {
    const args = buildHlsArgs("in.mp4", "/out", LADDER, true);
    const s = args.join(" ");
    expect(s).toContain("[0:v]split=2[v0][v1]");
    expect(s).toContain("force_divisible_by=2");
    expect(s).toContain("-var_stream_map v:0,a:0,name:360p v:1,a:1,name:720p");
    expect(s).toContain("-hls_playlist_type vod");
    expect(s).toContain("expr:gte(t,n_forced*6)");
    expect(args.at(-1)).toBe("/out/%v/index.m3u8");
  });

  it("omits audio mapping for silent sources", () => {
    const s = buildHlsArgs("in.mp4", "/out", LADDER.slice(0, 1), false).join(" ");
    expect(s).not.toContain("0:a:0");
    expect(s).toContain("-var_stream_map v:0,name:360p");
  });

  it("builds thumbnail args and parses ffprobe output", () => {
    expect(buildThumbnailArgs("in", 12.345, "t.jpg")).toContain("12.35");
    const p = parseProbe(
      JSON.stringify({
        format: { duration: "61.4" },
        streams: [{ codec_type: "video", height: 720 }, { codec_type: "audio" }],
      }),
    );
    expect(p).toEqual({ durationSeconds: 61, height: 720, hasAudio: true });
    expect(parseProbe("{}")).toEqual({ durationSeconds: null, height: null, hasAudio: false });
  });
});
