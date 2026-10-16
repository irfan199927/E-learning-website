## What and why

<!-- One or two sentences. Link the issue or NEXT_STEPS item. -->

## How it was tested

<!-- Commands run, screenshots for UI changes (desktop + mobile), anything not tested and why. -->

## Checklist

- [ ] `pnpm check` passes (format, lint, typecheck, unit tests)
- [ ] Integration / e2e tests added or updated where behaviour changed
- [ ] Routes go through `route()` and services; no `@elearner/db` imports in route handlers
- [ ] Access checks: `assertCan()` + `server/policies.ts`; unauthorised resources return NOT_FOUND
- [ ] Database: new migration (never edit a deployed one); backward compatible with the running app
- [ ] New env vars added to `env.ts`, `.env.example` and docs
- [ ] UI: keyboard + screen-reader friendly, 44 px targets, times in the user's timezone (`docs/ui.md`)
- [ ] Docs updated (`CHANGELOG.md`, and `CLAUDE.md` / `docs/` if conventions changed)
