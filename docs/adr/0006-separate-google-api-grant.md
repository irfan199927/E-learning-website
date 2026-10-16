# ADR-0006: Google API access is a separate teacher grant, in an Internal OAuth app

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

The app needs these Google permissions:

- Calendar access to create classes with Meet links;
- Meet access to read conference records, participants and recordings;
- Drive access to download recordings.

Only teachers need any of them. Students and parents only sign in.

Google classes these as sensitive or restricted scopes. For an **External** OAuth app, they need Google's
verification, and the Drive scope also needs a paid CASA security assessment, which takes 4–8 weeks. The school
already has Google Workspace.

## Decision

- **An Internal OAuth app** in the school's Workspace. Only school accounts can use it, and no verification is
  needed.
- **Sign-in asks only for `openid email profile`**, for everyone.
- **API scopes are a separate, incremental grant.** A teacher is sent through it the first time they schedule a
  class (`packages/google/src/oauth.ts`, `server/services/google-connect.ts`). The scopes are:
  - `calendar.events`;
  - `meetings.space.readonly`, because Meets created through Calendar aren't covered by `meetings.space.created`;
  - `drive.meet.readonly`, which only covers files Meet created and is narrower than `drive.readonly`.
- The grant asks for offline access. The refresh token is **encrypted** (AES-256-GCM, keyring with rotation) and
  stored per teacher. The OAuth `state` is signed and expires. The Workspace domain is enforced.
- If Google reports `invalid_grant`, the token is marked revoked and the teacher is asked to reconnect.

## Alternatives considered

- **Ask for every scope at sign-in.** Students and parents would see a scary consent screen for access they never
  use.
- **An External app.** Needed only if the product is sold to other schools. The verification and CASA cost is then
  unavoidable.
- **A domain-wide-delegation service account.** It needs no per-teacher consent, but it is far too much power: it
  can act as any user in the domain.

## Consequences

- Parents and anyone outside the school can't use Google features. They sign in with email and password.
- Each teacher has one extra consent step, once.
- A leaked database alone doesn't expose Google access. The encryption keys live only in the environment.
- Moving to more than one school means switching to External and going through verification (architecture.md §8).
