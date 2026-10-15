# E-learner

Live classes on Google Meet, auto-synced recordings in a gated HLS library, schedules and coursework for schools.

- **Start here:** [`CLAUDE.md`](CLAUDE.md) — layout, commands, architecture rules, gotchas
- **Product spec:** [`docs/SPEC.md`](docs/SPEC.md)
- **What's left:** [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md)

```bash
pnpm install && pnpm infra:up && cp .env.example .env
pnpm db:migrate && pnpm db:seed && pnpm dev
```
