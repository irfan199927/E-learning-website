# ADR-0005: Private R2 bucket; HLS playlists served through the API

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

The video library holds class recordings of children and teachers' uploads. Only enrolled students, the course
teacher and admins may watch a video. If a link is shared, it must stop working soon.

Video is heavy on egress: the estimated peak is about 435 Mbps (architecture.md §5.1). Teachers upload files of
several GB from school networks.

## Decision

- **Cloudflare R2** (S3-compatible, no egress fees) holds originals, HLS renditions and thumbnails. MinIO is used
  locally. All access goes through `packages/storage`.
- The bucket is **private**. Nothing is served from a public URL, and bucket listing is never exposed.
- **Uploads** go from the browser straight to R2 as multipart uploads, with presigned part URLs that expire after
  1 hour. The web app only handles small JSON requests.
- **Playback:** the player asks `/api/v1/videos/:id/hls/...`, which checks access on every request.
  - Child playlists are rewritten to point back at the API.
  - Segment URIs become **presigned R2 URLs**. They expire after twice the video's length plus 30 minutes, with a
    minimum of 1 hour.
  - Paths are resolved and checked so they can't leave the video's folder (`packages/core/src/hls.ts`).
- The worker transcodes with ffmpeg into HLS renditions (ADR-0002).

## Alternatives considered

- **A public CDN path with obscure keys.** Anyone with the URL could watch, forever.
- **Signed cookies or a Cloudflare Worker doing token auth.** Better for caching (see Consequences), but more
  infrastructure. Kept as the fix for gap G2.
- **Cloudflare Stream or Mux.** Managed transcoding and signed playback, but a per-minute cost, another processor
  of children's data, and less control.
- **AWS S3 + CloudFront.** Egress fees make it the most expensive option for video.

## Consequences

- Access is checked on every playlist request, and leaked segment links expire.
- Segments are fetched from `*.r2.cloudflarestorage.com` directly, so **they aren't cached by a CDN** (gap G2).
  That's fine at pilot scale. It needs revisiting above about 1 Gbps.
- The storage origin must be allowed in the CSP (`connect-src`, `media-src`, `img-src`), which is done from
  `S3_ENDPOINT`.
- R2 CORS must allow `PUT` from `APP_URL` and **expose `ETag`**, or multipart completion fails (deployment.md).
- Originals are deleted 30 days after transcoding (gap G6), so old videos can't be re-transcoded.
