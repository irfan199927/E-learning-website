/**
 * Browser-side multipart upload engine: N parts in parallel, per-part retry with backoff,
 * byte-level progress. Framework-free so it can be unit-tested with a fake `put`.
 *
 * Storage CORS must expose the ETag header (docs/deployment.md#storage-cors).
 */

export interface UploadOptions {
  file: Blob;
  partSize: number;
  partCount: number;
  signal?: AbortSignal;
  concurrency?: number;
  retries?: number;
  presign(partNumbers: number[]): Promise<{ partNumber: number; url: string }[]>;
  onProgress?(pct: number): void;
  /** Injected for tests; defaults to XHR (fetch has no upload progress). */
  put?(url: string, body: Blob, onBytes: (loaded: number) => void, signal?: AbortSignal): Promise<string>;
  sleep?(ms: number): Promise<void>;
}

export async function uploadParts(o: UploadOptions): Promise<{ partNumber: number; etag: string }[]> {
  const { file, partSize, partCount, concurrency = 4, retries = 3 } = o;
  const put = o.put ?? xhrPut;
  const sleep = o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const loaded = new Array<number>(partCount).fill(0);
  const report = () =>
    o.onProgress?.(Math.min(100, Math.floor((loaded.reduce((a, b) => a + b, 0) / file.size) * 100)));
  const results: { partNumber: number; etag: string }[] = [];
  const queue = Array.from({ length: partCount }, (_, i) => i + 1);

  // Presign in batches of up to 100 as workers need them (URLs live 1 h).
  const urls = new Map<number, string>();
  async function urlFor(n: number): Promise<string> {
    if (!urls.has(n)) {
      const batch = queue.filter((x) => !urls.has(x)).slice(0, 100);
      for (const u of await o.presign(batch.includes(n) ? batch : [n, ...batch.slice(0, 99)]))
        urls.set(u.partNumber, u.url);
    }
    return urls.get(n)!;
  }

  async function worker() {
    for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
      const chunk = file.slice((n - 1) * partSize, Math.min(n * partSize, file.size));
      for (let attempt = 0; ; attempt++) {
        if (o.signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
        try {
          const etag = await put(await urlFor(n), chunk, (b) => ((loaded[n! - 1] = b), report()), o.signal);
          results.push({ partNumber: n, etag });
          break;
        } catch (err) {
          loaded[n - 1] = 0;
          if (attempt >= retries || o.signal?.aborted) throw err;
          urls.delete(n); // URL may have expired
          await sleep(1000 * 2 ** attempt);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, partCount) }, worker));
  return results.sort((a, b) => a.partNumber - b.partNumber);
}

function xhrPut(
  url: string,
  body: Blob,
  onBytes: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => {
      const etag = xhr.getResponseHeader("ETag");
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag);
      else
        reject(
          new Error(
            etag
              ? `Part upload failed (${xhr.status})`
              : "Storage did not expose the ETag header (check CORS)",
          ),
        );
    };
    xhr.onerror = () => reject(new Error("Network error"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}
