# A teacher's Google connection stopped working

## Symptoms

- The teacher sees "Your Google connection expired. Reconnect Google to continue." (API code
  `GOOGLE_RECONNECT_REQUIRED`) when scheduling, moving or cancelling a Meet class.
- Recordings for their classes stop arriving ([recording-sync.md](recording-sync.md)).
- Changes they make directly in Google Calendar stop showing up.

## Why

Each teacher grants E-learner access to their Calendar, Meet and Drive. The refresh token is stored encrypted in
`GoogleCredential` (keyring `TOKEN_ENC_KEYS`). When Google refuses it (the teacher revoked access, changed their
password, an admin removed the app, or the token expired), the Google wrapper marks the credential revoked
(`GoogleCredential.revokedAt`, `packages/google/src/credential-store.ts`) and every call needs a reconnect.

## Fix

1. The teacher opens **Calendar** in E-learner and uses **Connect Google** (it goes to
   `/api/v1/google/connect`), signing in with the same school account they host classes with.
2. Check it worked:

   ```sql
   select "userId", "revokedAt", "updatedAt" from "GoogleCredential"
   where "userId" = (select id from "User" where email = '<teacher email>');
   ```

   `revokedAt` should be empty and `updatedAt` recent.

3. Calendar push channels (`WatchChannel`) are renewed daily by the `renew-watch-channels` maintenance job, so
   two-way sync resumes by the next day at the latest.
4. Recordings that gave up while the connection was broken: re-arm them as described in
   [recording-sync.md](recording-sync.md) (within 24 h of the class), or upload manually.

## If it keeps happening

- The Google Workspace admin may have restricted the app: check the OAuth app is still trusted for the
  teachers' OU ([../google-setup.md](../google-setup.md)).
- `TOKEN_ENC_KEYS` changed without keeping the old key: stored tokens can't be decrypted, so every teacher has
  to reconnect once ([rotate-secrets.md](rotate-secrets.md)).
