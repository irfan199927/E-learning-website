# Contributing

How changes get from an idea to `main`. Read [CLAUDE.md](CLAUDE.md) first for the architecture rules and the
gotchas. They apply to everyone, not just Claude Code.

## Set up

Follow the quickstart in [README.md](README.md): Node 22, pnpm 10, Docker. `pnpm install` also installs the git
hooks described below. Environment variables are explained in [docs/environment.md](docs/environment.md).

## Branches

- `main` is always deployable. Never push to it directly; every change goes through a pull request.
- Branch from the latest `main`. Name the branch after the work: `feat/parent-progress-view`,
  `fix/calendar-dst-shift`, `docs/google-setup`.
- Keep a branch to one change. A refactor needed for a feature can go in first as its own PR.
- To catch up with `main`, merge it into your branch. Don't rebase or force-push a branch someone else has
  checked out.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` hook runs
commitlint (`@commitlint/config-conventional`) and rejects anything else.

```
<type>(<optional scope>): <what changed, imperative, lower case>

<optional body: why, and anything a reviewer can't see from the diff>
```

- **Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `style`, `revert`.
- **Scopes** are package or area names: `web`, `worker`, `core`, `db`, `google`, `storage`, `queue`, `notify`,
  `e2e`, `infra`.
- Examples: `feat(web): parent view of a child's progress`, `fix(worker): retry Drive 429s with backoff`.

The `pre-commit` hook runs lint-staged: ESLint `--fix` and Prettier on staged files. If it fails, fix the error and
commit again. Don't skip the hooks with `--no-verify`.

**Never commit** `.env` files, credentials, recordings or other student data, or generated output (`.next`,
`out`, `dist`, `packages/db/src/generated`).

## Before you open a PR

Run the same checks CI runs. The first line is the minimum for any change:

```bash
pnpm check                                    # format, lint, typecheck, unit tests
pnpm --filter @elearner/web test:int          # if you touched services or the database (needs pnpm infra:up)
pnpm --filter @elearner/worker test:int       # if you touched the worker
pnpm --filter @elearner/web build && pnpm test:e2e   # if you touched UI or routes
pnpm build:site                               # if you touched the landing page
```

For UI changes, look at the screen on a phone-sized window and in both themes, and try it with the keyboard.

## Pull requests

The PR template is filled in automatically. Fill in each section:

- **What and why:** one or two sentences, with a link to the issue or the `docs/NEXT_STEPS.md` item.
- **How it was tested:** the commands you ran, plus desktop and mobile screenshots for UI changes. Say what you
  didn't test and why.
- **Checklist:** tick only what is true. Leave a box unticked and explain why when it doesn't apply.

CODEOWNERS requests a review automatically. Auth, access control, crypto, the database schema, CI/CD and
Dockerfiles always need the owner's review.

Every PR must pass these checks before it can merge:

| Check                                | What it runs                                                |
| ------------------------------------ | ----------------------------------------------------------- |
| Format, lint, typecheck, unit tests  | `pnpm check`                                                |
| Integration tests (Postgres, ffmpeg) | migrations from zero, then web and worker integration tests |
| Build + Playwright e2e               | production build, then the e2e suite on desktop and mobile  |
| Docker images (web), (worker)        | builds both images and smoke-tests them                     |
| Static landing site                  | `pnpm build:site` and checks the output                     |

PRs are merged with a merge commit. Delete the branch after merging.

## Definition of done

A change is done when all of these are true:

1. It does what the issue or NEXT_STEPS item asked, and nothing it didn't.
2. It follows the architecture rules in CLAUDE.md:
   - route → service → Prisma, and routes never import `@elearner/db`;
   - access checks through `assertCan()` and `server/policies.ts`, returning NOT_FOUND for resources the user
     can't see;
   - `packages/*` stay free of Next.js and React.
3. New behaviour has tests at the lowest level that can catch a regression: unit tests for pure logic,
   integration tests for services and jobs, e2e tests for user flows.
4. Database changes are a **new** migration that stays compatible with the version already running. Never edit a
   deployed migration ([docs/deployment.md](docs/deployment.md) → Releasing).
5. New environment variables are in `env.ts`, `.env.example` and [docs/environment.md](docs/environment.md).
6. UI follows [docs/ui.md](docs/ui.md):
   - keyboard and screen-reader friendly, with 44 px touch targets;
   - times shown in the user's timezone;
   - works in light and dark, and with reduced motion.
7. Docs are updated:
   - a `CHANGELOG.md` entry under **Unreleased**;
   - `docs/NEXT_STEPS.md` ticked;
   - `CLAUDE.md` or `docs/` when a convention changed.
8. CI is green and a reviewer approved.

## Security issues

Don't open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
