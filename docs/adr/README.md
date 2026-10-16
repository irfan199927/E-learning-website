# Architecture decision records

Short records of decisions that shape the codebase: what was decided, why, and what it costs. Code comments point
here as `ADR-000N`.

| ADR                                                   | Decision                                                    | Status   |
| ----------------------------------------------------- | ----------------------------------------------------------- | -------- |
| [0001](0001-monorepo.md)                              | One pnpm + Turborepo monorepo                               | Accepted |
| [0002](0002-route-handlers-and-worker.md)             | Next.js route handlers plus one worker process, not NestJS  | Accepted |
| [0003](0003-better-auth-database-sessions.md)         | Better Auth with database sessions, not JWTs                | Accepted |
| [0004](0004-prisma-7.md)                              | Prisma 7 with the `pg` driver adapter                       | Accepted |
| [0005](0005-r2-gated-hls.md)                          | Private R2 bucket; HLS playlists served through the API     | Accepted |
| [0006](0006-separate-google-api-grant.md)             | Google API access is a separate teacher grant, Internal app | Accepted |
| [0007](0007-recurring-classes-as-google-instances.md) | Recurring classes stored as Google's own event instances    | Accepted |

## Writing a new one

Copy the shape of an existing record: **Context** (the forces), **Decision**, **Alternatives considered**,
**Consequences** (good and bad). Number it next in sequence and add it to the table. Don't rewrite an accepted
record when a decision changes. Write a new one that supersedes it, and set the old one's status to
`Superseded by ADR-000N`.
