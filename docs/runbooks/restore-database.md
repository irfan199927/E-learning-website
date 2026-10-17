# Backups and restoring the database

## UAT (Docker Compose on the VM)

**Back up** (also before any risky change):

```bash
deploy/uat/manage.sh backup        # → /opt/elearner/backups/elearner-<date>.sql.gz (pg_dump --clean --if-exists)
```

Nightly: add a cron entry for the `elearner` user (see [../uat.md](../uat.md)):
`15 2 * * * /opt/elearner/app/deploy/uat/manage.sh backup`. Copy backups off the VM too; a dump on the same
disk doesn't survive a disk failure.

**Restore:**

1. Stop the app so nothing writes meanwhile:
   `docker compose -f deploy/uat/compose.yaml stop web worker`.
2. Load the dump (it drops and recreates objects):

   ```bash
   gunzip -c /opt/elearner/backups/elearner-<date>.sql.gz \
     | docker compose -f deploy/uat/compose.yaml exec -T postgres psql -U elearner elearner
   ```

3. Bring the schema up to the running code (a dump from before a newer release lacks its migrations):
   `deploy/uat/deploy.sh` runs `prisma migrate deploy`, or run the migrate step it uses by hand.
4. Start the app: `docker compose -f deploy/uat/compose.yaml up -d web worker`.
5. Check: `/api/health/ready` returns `ok` for database and redis; sign in as an admin; open a course and a video.

**Not in the dump:** uploaded files and videos live in MinIO (`miniodata` volume) and Redis holds queued jobs.
Restoring an old database next to newer files leaves orphaned files (the `sweep-orphan-uploads` job removes
them after 2 days); files newer than the dump that the database doesn't know about are lost to users.

## Production (AWS, planned)

Not built yet. The plan in [../deployment.md](../deployment.md) is RDS with automated snapshots and
point-in-time recovery: restore to a new instance, run `prisma migrate deploy` against it, point the app's
`DATABASE_URL` at it, then check as in step 5.
