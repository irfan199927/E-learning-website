# ADR-0003: Better Auth with database sessions, not JWTs

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Most users are children. A school admin or a parent must be able to cut off a child's access **immediately**: when
consent is withdrawn, a device is lost, or an account is misused.

Other requirements:

- No self sign-up. Admins create accounts.
- Email and password for parents, who often don't have school Google accounts.
- Google sign-in for school accounts.
- Mandatory email verification and password reset.
- An inactive account (for example, a minor without parental consent) must not be able to sign in at all.

## Decision

[Better Auth](https://better-auth.com) (`apps/web/src/lib/auth.ts`) with its Prisma adapter and **database
sessions**:

- Sessions are rows in Postgres, checked on every request. The cookie cache is off.
- Sessions last 7 days and are refreshed daily. A password reset revokes every session.
- Sign-up is disabled for both email and Google. Google sign-in is limited to the school's Workspace domain.
- A database hook refuses to create a session for an inactive or deleted user.
- Rate limits are stored in Redis through an atomic Lua `consume()`. Better Auth 1.7 needs this for custom storage.

## Alternatives considered

- **JWT sessions** (stateless). A token stays valid until it expires, so revocation is either slow or needs a
  denylist, which is a session table by another name.
- **Auth.js (NextAuth).** The spec first named it. Better Auth has built-in email and password with verification,
  rate limits and database hooks, which Auth.js leaves to the app.
- **A hosted identity provider** (Clerk, Auth0). That puts children's personal data with another processor, which
  matters under DPDP, and adds per-user cost.

## Consequences

- Revoking a session or deactivating a user takes effect on the next request.
- Every authenticated request costs one indexed session lookup. That's fine at this scale.
- Better Auth owns the `User`, `Session`, `Account` and `Verification` tables. Their field names must stay as
  Better Auth expects; for example, `emailVerified` is a Boolean.
- `APP_URL` must exactly match the browser's origin, or Better Auth rejects requests (see environment.md).
