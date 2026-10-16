/**
 * Object storage. The bucket is PRIVATE: nothing is ever served by public URL.
 * Browsers upload straight to storage with presigned part URLs and download through
 * short-lived presigned GETs issued after an access check (ADR-0005).
 */
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

export interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

/** Canonical object keys. Keep all key building here so layouts never drift between apps. */
export const keys = {
  videoRaw: (videoId: string, ext: string) => `videos/${videoId}/raw.${ext.replace(/^\./, "")}`,
  videoHlsPrefix: (videoId: string) => `videos/${videoId}/hls/`,
  videoThumb: (videoId: string) => `videos/${videoId}/thumb.jpg`,
  attachment: (lessonId: string, id: string, fileName: string) =>
    `attachments/${lessonId}/${id}/${fileName.replace(/[^\w.-]+/g, "_").slice(0, 120)}`,
};

export function extensionFor(mimeType: string): string {
  return { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" }[mimeType] ?? "bin";
}

export class Storage {
  readonly s3: S3Client;
  readonly bucket: string;

  constructor(cfg: StorageConfig) {
    this.bucket = cfg.bucket;
    this.s3 = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: cfg.forcePathStyle ?? false,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      // R2 does not support the newer default checksum headers on presigned uploads.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async createMultipart(key: string, contentType: string): Promise<string> {
    const res = await this.s3.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
    );
    if (!res.UploadId) throw new Error("Storage did not return an UploadId");
    return res.UploadId;
  }

  presignPart(key: string, uploadId: string, partNumber: number, expiresInSec = 3600): Promise<string> {
    return getSignedUrl(
      this.s3,
      new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
      { expiresIn: expiresInSec },
    );
  }

  async completeMultipart(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<void> {
    await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    );
  }

  async abortMultipart(key: string, uploadId: string): Promise<void> {
    await this.s3.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
    );
  }

  presignGet(key: string, expiresInSec: number, opts: { contentDisposition?: string } = {}): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: opts.contentDisposition,
      }),
      { expiresIn: Math.min(expiresInSec, 7 * 24 * 3600) },
    );
  }

  async head(key: string): Promise<{ size: number; contentType: string | undefined } | null> {
    try {
      const res = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch (err) {
      if ((err as { name?: string }).name === "NotFound") return null;
      throw err;
    }
  }

  async getText(key: string): Promise<string> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error(`Empty object: ${key}`);
    return res.Body.transformToString("utf-8");
  }

  /** Streaming upload of unknown length (e.g. Drive → R2). Uses multipart under the hood. */
  async putStream(key: string, body: Readable | Buffer, contentType: string): Promise<void> {
    const upload = new Upload({
      client: this.s3,
      params: { Bucket: this.bucket, Key: key, Body: body, ContentType: contentType },
      queueSize: 4,
      partSize: 16 * 1024 * 1024,
      leavePartsOnError: false,
    });
    await upload.done();
  }

  /** Delete one object. Deleting a key that doesn't exist succeeds (S3 semantics). */
  async deleteObject(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deletePrefix(prefix: string): Promise<number> {
    let deleted = 0;
    let token: string | undefined;
    do {
      const list = await this.s3.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const objects = (list.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
      if (objects.length) {
        await this.s3.send(
          new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objects, Quiet: true } }),
        );
        deleted += objects.length;
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
    return deleted;
  }
}
