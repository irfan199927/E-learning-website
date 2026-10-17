# A video is stuck or failed

## Statuses (`Video.status`)

| Status           | Meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `PENDING_UPLOAD` | The browser is still uploading (multipart)                                |
| `UPLOADED`       | Upload finished; a `transcode` job is queued                              |
| `TRANSCODING`    | ffmpeg is making the HLS renditions (`apps/worker/src/jobs/transcode.ts`) |
| `READY`          | Students can watch it                                                     |
| `FAILED`         | The last attempt failed; the reason is in `Video.error`                   |

Transcode jobs retry with exponential back-off (BullMQ `attempts`/`backoff` in `packages/queue/src/index.ts`).
Only after the **last** attempt does the worker mark the video `FAILED` (`markTranscodeFailed`).

## Check

```sql
select id, title, status, error, "rawKey", "hlsPrefix", "replacesLessonId", "updatedAt"
from "Video" where id = '<video id>';
```

- Worker logs: `deploy/uat/manage.sh logs worker`, search for the video id.
- `PENDING_UPLOAD` for more than a day: the upload was abandoned; the maintenance job `abort-stale-uploads` fails
  it. Ask the teacher to upload again.
- `FAILED` with an ffmpeg error: usually a damaged or unusual file. Try converting it to a normal MP4 (H.264 +
  AAC) and uploading again.
- Stuck in `UPLOADED`/`TRANSCODING` with no worker activity: check the worker is running
  (`deploy/uat/manage.sh status`) and its health endpoint; restart it if needed. Jobs survive restarts (Redis).
- Disk full on the worker: transcoding writes to a temp folder; free space and restart.

## Fix

- **Re-upload** (simplest): for a video lesson, Edit lesson → **Replace video**. Students keep the old video
  (if any) until the new one is `READY`; the worker then points the lesson at it (`Video.replacesLessonId`).
- **Re-run a failed transcode** when the original is still in storage (`rawKey` is set): put the video back to
  `UPLOADED` and queue a job. From a shell in the web or worker container, using the Jobs producer
  (`enqueueTranscode`) is the supported way; if you can't, a re-upload is the safe fallback.

Note: the original upload is deleted 30 days after a successful transcode (`delete-transcoded-raw`), so old
`READY` videos can't be re-transcoded from the original.
