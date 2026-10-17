# Testing

How the tests are organised, how to run them, and the conventions that keep them reliable. CI
(`.github/workflows/ci.yml`) runs every layer below on each pull request; `main` deploys only when it is green.

## Layers

| Layer               | Where                                                | Runs against                                  | Command                                   |
| ------------------- | ---------------------------------------------------- | --------------------------------------------- | ----------------------------------------- |
| Core unit           | `packages/*/src/**/*.test.ts`                        | Nothing: pure functions                       | `pnpm test`                               |
| Web unit            | `apps/web/src/**/*.test.ts(x)`                       | Fakes (`src/test/fakes.ts`)                   | `pnpm test`                               |
| Web integration     | `apps/web/src/**/*.int.test.ts`                      | Real Postgres (`DATABASE_URL`), fake Google   | `pnpm --filter @elearner/web test:int`    |
| Worker integration  | `apps/worker/src/**/*.int.test.ts`                   | Real Postgres, real ffmpeg, in-memory storage | `pnpm --filter @elearner/worker test:int` |
| End-to-end          | `apps/web/e2e/*.spec.ts` (desktop + mobile Chromium) | Production build, seeded DB, Redis, MinIO     | `pnpm test:e2e`                           |
| Static site, images | CI jobs "Static landing site" and "Docker images"    | `pnpm build:site`; `docker build` + smoke     | see `ci.yml`                              |
| Format, lint, types | Whole repo                                           | —                                             | `pnpm check` (also runs unit tests)       |

What goes where:

- **Rules** (grading, scoring, streaks, time zones, CSV escaping, RBAC, HLS rewriting) are pure functions in
  `packages/core` and get unit tests there. Prefer this layer: it is fast and needs nothing running.
- **Services** are tested in integration against real Postgres, because most bugs live in the queries (access
  checks, `where` clauses, transactions). Google, storage, the job queue and email are fakes from
  `src/test/fakes.ts` (`fakeGoogle`, `fakeStorage`, `fakeJobs`; `makeDeps` wires them).
- **Pages and flows** get a Playwright spec when a user-visible journey matters (sign in, join a class, hand in
  work, pay, delete an account). Keep these few and focused; check details in the layers below.

## Running locally

```bash
pnpm infra:up                                     # postgres, redis, minio, mailpit
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm check                                        # format, lint, typecheck, unit tests
pnpm --filter @elearner/web test:int
pnpm --filter @elearner/worker test:int           # needs ffmpeg on PATH
pnpm --filter @elearner/web build && pnpm test:e2e
```

- Anything run outside turbo on a fresh checkout (`db:seed`, `test:int`) needs `pnpm db:generate` first.
- Playwright starts `next start` on port 3100 with `APP_URL=http://localhost:3100` (`playwright.config.ts`).
  Locally it reuses a server already on that port, so after a rebuild stop the old one (by PID: `pkill -x
next-server` doesn't match).
- To use an installed Chromium instead of Playwright's download, set `PLAYWRIGHT_CHROMIUM_PATH`.
- Run one file or test: `pnpm --filter @elearner/web test:int -- gradebook`, `pnpm test:e2e -- payments.spec.ts
-g "approve"`. `--project=desktop` skips the mobile run.

### Resetting the dev database for e2e

The e2e suite and the integration tests share the dev database, and repeated local runs accumulate data and hit
sign-in rate limits. If e2e runs start failing on things like "too many requests" or a calendar full of old
classes:

```bash
docker compose exec -T redis sh -c "redis-cli --scan --pattern 'rl:*' | xargs -r redis-cli del"   # rate limits
pnpm db:seed                                                                                        # re-seed users
AUTH_SIGNIN_LIMIT_PER_MIN=100 pnpm test:e2e
```

For a clean slate, `docker compose down -v && pnpm infra:up`, then migrate and seed again.

## Conventions

- **Unique fixtures.** Integration tests share one database (the dev DB locally, a fresh one in CI) and run
  in any order. Every id, slug, email and Google event id a test creates includes `randomUUID()`; `world()` in
  `fakes.ts` builds a teacher, students and a course this way. Never assume a table is empty or count rows
  globally: filter by your own fixtures.
- **One Prisma pool.** Integration files get their client from `testDb()`, which keeps a single pool on
  `globalThis`. Creating a client per file exhausts Postgres connections ("too many clients").
- **Search for your own course** in e2e. The catalog and lists cap their length (`CATALOG_LIMIT`), so a spec
  that creates a course must search for it by its unique name rather than expect it on the first page.
- **State-independent e2e.** A spec must pass whether or not a previous run left data behind (for example, the
  recording-consent spec withdraws consent first). Use the seeded users (`*@school.edu`,
  `parent@example.com`, password `Password123!`) and create everything else with unique names.
- **Locators:** prefer roles and labels; use `exact: true` for nav links ("Courses" also matches "My courses").
- **Time:** services take `deps.now()`; pass a fixed `now` instead of sleeping or relying on the wall clock.
  Learner days are local dates (`localDayKey`), so tests that cross midnight set the actor's time zone.
- **Access checks:** for every new read path, test that a user outside the course gets `NOT_FOUND`, not the data
  and not `FORBIDDEN`.
- **No skipping.** Don't skip, disable or quarantine a failing test to get CI green: fix the cause. A test that
  is flaky gets made deterministic.
- **The service worker:** Playwright's offline mode doesn't reach service-worker fetches, so `e2e/pwa.spec.ts`
  checks the cache contents rather than simulating an outage.

## CI specifics

- Unit job: `format:check`, `lint`, `typecheck`, `test`.
- Integration job: Postgres service container, `db:deploy` from zero (proves the migrations apply cleanly), then
  web and worker integration tests; ffmpeg is installed so the transcode test runs for real.
- E2E job: Postgres, Redis and MinIO, `db:deploy`, `db:seed`, production build, Playwright with 2 retries. The
  HTML report is uploaded as the `playwright-report` artifact on failure.
- Docker job builds both images and checks they start as a non-root user.
