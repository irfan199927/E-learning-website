import { describe, expect, it, vi } from "vitest";
import { uploadParts } from "./multipart";

const file = new Blob([new Uint8Array(25)]); // 25 bytes, partSize 10 → 3 parts
const presign = async (ns: number[]) => ns.map((n) => ({ partNumber: n, url: `u${n}` }));
const noSleep = () => Promise.resolve();

describe("uploadParts", () => {
  it("uploads every part, reports progress to 100% and returns sorted etags", async () => {
    const progress: number[] = [];
    const put = vi.fn(async (url: string, body: Blob, onBytes: (n: number) => void) => {
      onBytes(body.size);
      return `"etag-${url}"`;
    });
    const parts = await uploadParts({
      file,
      partSize: 10,
      partCount: 3,
      presign,
      put,
      onProgress: (p) => progress.push(p),
      sleep: noSleep,
    });
    expect(parts).toEqual([
      { partNumber: 1, etag: '"etag-u1"' },
      { partNumber: 2, etag: '"etag-u2"' },
      { partNumber: 3, etag: '"etag-u3"' },
    ]);
    expect(progress.at(-1)).toBe(100);
    expect(put.mock.calls.map((c) => (c[1] as Blob).size).sort()).toEqual([10, 10, 5]);
  });

  it("retries a failed part with a fresh URL", async () => {
    let failures = 1;
    const presignSpy = vi.fn(presign);
    const put = vi.fn(async (url: string) => {
      if (url === "u2" && failures-- > 0) throw new Error("network");
      return `"${url}"`;
    });
    const parts = await uploadParts({
      file,
      partSize: 10,
      partCount: 3,
      presign: presignSpy,
      put,
      sleep: noSleep,
      concurrency: 1,
    });
    expect(parts).toHaveLength(3);
    expect(put).toHaveBeenCalledTimes(4);
  });

  it("gives up after the retry budget", async () => {
    const put = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(
      uploadParts({
        file,
        partSize: 10,
        partCount: 3,
        presign,
        put,
        sleep: noSleep,
        retries: 1,
        concurrency: 1,
      }),
    ).rejects.toThrow("down");
  });

  it("stops when aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      uploadParts({
        file,
        partSize: 10,
        partCount: 3,
        presign,
        put: async () => "e",
        signal: ctrl.signal,
        sleep: noSleep,
      }),
    ).rejects.toThrow(/cancelled/);
  });
});
