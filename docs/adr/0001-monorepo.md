# ADR-0001: One pnpm + Turborepo monorepo

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

The product has two deployables, the Next.js web app and a background worker. They share a lot:

- the database schema and client;
- the job names and payloads that pass between them;
- domain rules such as access control, time zones, attendance and HLS rewriting;
- the Google and storage clients.

A mismatch in a job payload between web and worker fails silently at runtime. The team is small, and one person
usually changes both sides at once.

## Decision

One repository, managed with pnpm workspaces and Turborepo:

- `apps/web` and `apps/worker` are the deployables.
- `packages/*` hold the shared code: `core`, `db`, `google`, `storage`, `queue` and `notify`.
- Packages stay framework-agnostic: no Next.js or React imports. Client components import only the browser-safe
  subpaths of `core`.
- Job payloads are zod schemas in `packages/queue`, so changing one is a compile error on both sides.
- Packages are consumed as TypeScript source. Next.js transpiles them, and the worker bundles them with tsup while
  keeping npm dependencies external.

## Alternatives considered

- **Separate repositories with published packages.** This means versioning and releases for code that always
  changes together, and a stale package version can ship without anyone noticing.
- **One app that also runs the jobs.** Not possible: ffmpeg and long jobs can't run on serverless (ADR-0002).

## Consequences

- One PR changes the producer, the consumer and the schema together, and CI checks them together.
- Turborepo caches typecheck, test and build per package, so unchanged packages are skipped.
- Docker images must build from the repository root, and the worker image needs `pnpm deploy` to install only its
  runtime dependencies (see CLAUDE.md gotchas).
- Runtime dependencies of bundled packages must also be listed in `apps/worker/package.json`. This is easy to
  forget, and the worker image smoke test in CI catches it.
