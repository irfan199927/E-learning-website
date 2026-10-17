# Incident response

## Severity

| Level | Examples                                                                       | Respond     |
| ----- | ------------------------------------------------------------------------------ | ----------- |
| SEV1  | Site down during school hours; anyone can see another person's data; data loss | Immediately |
| SEV2  | Live classes can't be joined; uploads or recordings broken for everyone        | Within 1 h  |
| SEV3  | One teacher or course affected; a workaround exists                            | Same day    |

## First 15 minutes

1. **Say you're on it** to the school contact (one message: what's broken, that you're looking).
2. **Look:**
   - `/api/health` and `/api/health/ready` (database and redis checks).
   - `deploy/uat/manage.sh status` and `deploy/uat/manage.sh logs web` / `logs worker`.
   - Errors carry a `requestId` (shown in API error bodies and the `x-request-id` header): search the logs for it.
3. **Stop the bleeding:**
   - A bad release: roll back to the previous green commit (UAT pulls green `main`; see [../uat.md](../uat.md)).
   - A leaked secret: rotate it ([rotate-secrets.md](rotate-secrets.md)).
   - A compromised account: an admin switches it off on Admin → Users (signs it out everywhere).
4. Write down times and actions as you go; it becomes the postmortem.

## Personal data incidents (DPDP Act)

If personal data may have been exposed:

1. Contain it (above), and keep logs and the database as evidence (take a backup:
   `deploy/uat/manage.sh backup`).
2. Find what was accessed and whose: `AuditLog` records sensitive actions (role changes, grades, exports,
   consent, deletions, payments):

   ```sql
   select "createdAt", "actorId", action, "targetType", "targetId", meta
   from "AuditLog" where "createdAt" > now() - interval '7 days' order by "createdAt" desc;
   ```

3. The school's data protection contact decides on notifying the Data Protection Board and the affected people;
   the DPDP rules expect this without delay ([../security.md](../security.md)).

## After: blameless postmortem

```markdown
# Postmortem: <title> (<date>)

- Impact: who was affected, how, for how long
- Timeline (IST): detection → response → recovery
- Root cause: what actually broke and why it was possible
- What went well / what didn't
- Actions: one owner and date each (a test or a check so it can't happen again)
```
