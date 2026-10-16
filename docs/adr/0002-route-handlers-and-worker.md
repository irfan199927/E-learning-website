# ADR-0002: Next.js route handlers plus one worker process, not NestJS

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

The original brief suggested a NestJS backend next to a Next.js frontend. The school has fewer than 500 students,
and one small team builds and runs the product.

Some work can't run inside a request on serverless hosting:

- transcoding video with ffmpeg (minutes of CPU);
- downloading recordings from Drive;
- delayed reminders;
- scheduled housekeeping.

## Decision

- The web app's REST API (`/api/v1/*`) is **Next.js route handlers** in `apps/web`, deployed with the UI.
- Every handler goes through `route()` in `lib/http.ts`, which handles authentication, the role gate, the
  same-origin check, rate limits, zod validation and `application/problem+json` errors.
- Handlers call **services** (`server/services/*`) that take `(deps, actor, input)`. Production wiring lives in
  `server/container.ts`, and tests pass fakes.
- Route handlers may not import the database. ESLint enforces this.
- **One worker process** (`apps/worker`) runs every BullMQ queue consumer and the scheduled jobs. It is deployed as
  a long-running container (Render) with ffmpeg installed.

## Alternatives considered

- **A NestJS API service.** It would give modules, dependency injection and decorators, but adds a second web
  server, a second deploy, CORS between UI and API, and duplicated auth. The service layer above already gives
  testable, injected dependencies without the framework.
- **Serverless functions for jobs.** Execution time limits and no ffmpeg rule this out for transcoding.
- **A managed video service** (Mux, Cloudflare Stream) instead of a transcoding worker. This is reconsidered in
  architecture.md §8 if transcoding becomes a bottleneck. The worker is still needed for reminders, recording
  sync and housekeeping.

## Consequences

- One deploy and one language for UI and API. Server components can call services directly.
- The API isn't versioned or published separately. A native mobile app would need a versioned, OpenAPI-first API
  (architecture.md §8).
- Every page renders dynamically because of the nonce CSP. That doesn't matter behind a login, but there's no
  static caching. The public landing page is also exported separately as static files for Vercel.
- The worker is a single point for background work. Jobs are idempotent with deterministic ids, so a restart or
  a duplicated job is safe.
