# A class recording didn't appear

## How it works

1. Google Meet saves the recording to the **host teacher's** Drive (Workspace recording must be on for them;
   see [../google-setup.md](../google-setup.md)).
2. The worker's maintenance sweep marks ended classes and queues a `recording-sync` job per class
   (`apps/worker/src/jobs/recording-sync.ts`).
3. The job asks Meet for the class's conference records and recordings, streams each Drive file into storage,
   creates a `Video` (`source = MEET_RECORDING`) and a lesson, queues transcoding, and records attendance.
4. It keeps retrying while Meet is still processing. **24 hours after the class ended** it gives up
   (`RECORDING_GIVE_UP_MS`): it sets `ClassSession.recordingSyncedAt` and notifies the host: "No recording found
   … Upload the video manually from the Library".

## Check

1. Find the class:

   ```sql
   select id, title, "startsAt", "endsAt", status, "googleEventId", "meetConferenceId", "recordingSyncedAt", "hostId"
   from "ClassSession" where title ilike '%<title>%' order by "startsAt" desc limit 5;
   ```

2. Was anything imported?

   ```sql
   select id, status, error, "createdAt" from "Video" where "classSessionId" = '<class id>';
   ```

   - A row in `UPLOADED`/`TRANSCODING`/`FAILED`: it's a processing problem, see
     [transcode-failures.md](transcode-failures.md).

3. Look for the job in the worker logs: `deploy/uat/manage.sh logs worker`, search for the class id.
4. Common causes:
   - **No `googleEventId`**: the class was scheduled without Google (room or pasted link). Nothing to sync.
   - **The host wasn't the one recording**, or recording is off for their Workspace OU: the file is in someone
     else's Drive. Upload it manually.
   - **The host's Google grant expired**: the job can't call Meet. See [google-reconnect.md](google-reconnect.md).
   - **Still within 24 h and Meet is slow**: wait; the sweep retries.

## Fix

- **Manual upload (always works):** the teacher uploads the file from **Upload video** (or Edit lesson →
  **Replace video**). Students see it once processed.
- **Retry the sync after fixing Google:** clear the give-up marker so the next sweep picks the class up again:

  ```sql
  update "ClassSession" set "recordingSyncedAt" = null where id = '<class id>';
  ```

  The sweep runs every few minutes. Imports are idempotent (`Video.driveFileId` is unique), so a retry can't
  duplicate a recording. Note the 24-hour give-up still applies, counted from the class end.
