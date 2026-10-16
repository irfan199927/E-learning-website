# ADR-0004: Prisma 7 with the `pg` driver adapter

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

The data model is relational and fairly large: users, courses, enrolments, classes, attendance, videos, progress,
assignments, quizzes, payments and audit. Both the web app and the worker use it.

Other requirements:

- Migrations that are reviewed and applied in CI before each deploy.
- Typed queries, so access-control filters can't be misspelled.
- Neon Postgres in production, which recommends pooled connections.

## Decision

Prisma 7 in `packages/db`:

- The schema and SQL migrations live in `prisma/`. `prisma migrate deploy` runs in deploy.yml after a reviewer
  approves the `production` environment, using a **direct** (non-pooled) connection.
- The app connects through the `@prisma/adapter-pg` driver adapter with the pooled URL, so there's no separate
  query-engine binary.
- `prisma.config.ts` holds the datasource URL. The generated client goes to `packages/db/src/generated` and isn't
  committed.
- Migrations follow expand → deploy → contract (deployment.md). A deployed migration is never edited.

## Alternatives considered

- **Drizzle.** Lighter and closer to SQL; Prisma was chosen for its migration workflow and its schema as a
  single readable source for about 30 models.
- **Raw SQL or Kysely.** This gives full control, but means hand-writing types for about 30 models.
- **Prisma 6.** It needs the Rust query engine binary. Version 7 removes it, which also makes the Docker images
  smaller.

## Consequences

- Queries are fully typed, and the generated types flow into services and DTOs.
- The client must be generated before anything that imports it. Turborepo tasks depend on `generate`, but commands
  run outside Turborepo (`db:seed`, `test:int`) on a fresh checkout need `pnpm db:generate` first. CI does this
  explicitly.
- `@prisma/client`'s optional peer dependencies would add about 215 MB to the worker image unless
  `auto-install-peers=false` is used with `pnpm deploy` (CLAUDE.md).
