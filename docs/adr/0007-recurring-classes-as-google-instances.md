# ADR-0007: Recurring classes stored as Google's own event instances

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Teachers schedule weekly classes, for example Mon/Wed/Fri until the end of term. Each occurrence needs its own
row:

- attendance, the recording and reminders are per occurrence;
- one occurrence can be moved or cancelled on its own.

Teachers also edit classes directly in Google Calendar. Two copies of a recurrence rule, ours and Google's, drift
apart on exceptions, daylight-saving changes and edge cases.

## Decision

- A recurring class is **one recurring Google Calendar event** created with an RRULE
  (`packages/core/src/rrule.ts`; weekly, with chosen weekdays and an end date).
- We **don't expand the RRULE ourselves**. After creating the event we ask Google for its instances
  (`events.instances`) and store one `ClassSession` row per instance:
  - `googleEventId` is the instance id;
  - `seriesId` is the recurring event's id;
  - `recurrenceRule` is kept for information only.
- Series are capped at **200 days** (zod schema) and Google's **250 instances** per request.
- Changes made in Google Calendar come back through push notifications and incremental sync (`calendar-sync`
  job), which updates or cancels the matching instance rows and their reminders.
- Google is written first, then the database. If the database write fails, the Google event is deleted again.

## Alternatives considered

- **Expand the RRULE in our code** and create single events in Google. Students would get dozens of separate
  invites, and the series couldn't be edited as one in Google Calendar.
- **Store only the rule and compute occurrences on the fly.** Attendance, recordings and reminders need a stable
  row per occurrence, so we'd end up creating the rows anyway.

## Consequences

- Our occurrences always match Google's, including exceptions.
- Students get one invite for the whole series.
- Very long series must be split: the limit is 200 days, which covers a school term.
- Moving one occurrence is supported. Editing "this and following" occurrences isn't built yet; until it is,
  teachers do it in Google Calendar and the sync mirrors it.
- Calendar push notifications need a public HTTPS `APP_URL`, so local development doesn't see edits made in
  Google Calendar.
