# Rotating secrets

Secrets live in the environment of the web and worker containers (UAT: `/opt/elearner/app/.env`, created by
`deploy/uat/init-env.sh`). Every variable is described in [../environment.md](../environment.md). After changing
one, redeploy **both** services that use it (`deploy/uat/deploy.sh`).

| Secret                                       | Used by     | What rotating it does                                                                                                         |
| -------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                         | web         | Signs sessions and auth tokens. Everyone is signed out; reset/invite links already emailed stop working.                      |
| `TOKEN_ENC_KEYS` / `TOKEN_ENC_ACTIVE_KEY_ID` | web, worker | Encrypts stored Google tokens. Rotate by **adding** a key (below); dropping a key in use forces reconnects.                   |
| `GOOGLE_CLIENT_SECRET`                       | web, worker | Google OAuth client. Rotate in Google Cloud first, then update; old tokens keep working.                                      |
| `DATABASE_URL` (password)                    | web, worker | Change the Postgres user's password, then the URL; brief downtime while both restart.                                         |
| `REDIS_URL` (password, if any)               | web, worker | Same as the database. Queued jobs stay in Redis.                                                                              |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`  | web, worker | Create a new key in the storage provider, switch, then delete the old one. Signed URLs already issued expire within the hour. |
| `SMTP_URL` (password)                        | web, worker | Email only; update when the mail provider rotates it.                                                                         |

## Token encryption key (no downtime)

Follow [../environment.md](../environment.md) "Rotate the token encryption key": add `v2` next to `v1` in
`TOKEN_ENC_KEYS`, set `TOKEN_ENC_ACTIVE_KEY_ID=v2` on both services, redeploy. Old rows are re-encrypted with
`v2` when next read. Remove `v1` only when no row uses it; removing it early means those teachers reconnect
Google ([google-reconnect.md](google-reconnect.md)).

## If a secret leaked

1. Rotate it now (table above); for `BETTER_AUTH_SECRET` that also ends every session.
2. Check `AuditLog` and the logs for misuse in the exposure window ([incident-response.md](incident-response.md)).
3. Generate new values with `openssl rand -base64 32` (auth secret, token keys).
