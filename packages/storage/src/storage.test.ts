import { describe, expect, it } from "vitest";
import { extensionFor, keys, Storage } from "./index";

const storage = new Storage({
  endpoint: "http://localhost:9000",
  region: "auto",
  bucket: "media",
  accessKeyId: "a",
  secretAccessKey: "b",
  forcePathStyle: true,
});

describe("keys", () => {
  it("builds stable layouts and sanitises attachment names", () => {
    expect(keys.videoRaw("v1", ".mp4")).toBe("videos/v1/raw.mp4");
    expect(keys.videoHlsPrefix("v1")).toBe("videos/v1/hls/");
    expect(keys.attachment("l1", "a1", "My notes (final).pdf")).toBe("attachments/l1/a1/My_notes_final_.pdf");
    expect(extensionFor("video/webm")).toBe("webm");
    expect(extensionFor("x/unknown")).toBe("bin");
  });
});

describe("presigning (offline)", () => {
  it("signs part uploads with the upload id and part number", async () => {
    const url = new URL(await storage.presignPart("videos/v1/raw.mp4", "up-1", 3, 600));
    expect(url.pathname).toBe("/media/videos/v1/raw.mp4");
    expect(url.searchParams.get("partNumber")).toBe("3");
    expect(url.searchParams.get("uploadId")).toBe("up-1");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
  });
  it("caps GET expiry at 7 days", async () => {
    const url = new URL(await storage.presignGet("k", 30 * 24 * 3600));
    expect(url.searchParams.get("X-Amz-Expires")).toBe(String(7 * 24 * 3600));
  });
});
