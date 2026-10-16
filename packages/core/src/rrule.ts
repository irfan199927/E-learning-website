/** Build the RFC 5545 RRULE line that Google Calendar expects for recurring classes. */
import { utcToZonedInput, zonedInputToUtc } from "./time";

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Recurrence {
  freq: "WEEKLY";
  byDay: Weekday[];
  /** Last day the series may occur (inclusive). */
  until: Date;
}

/** Google requires UNTIL in UTC basic format when DTSTART has a TZID. */
function toUtcBasic(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function buildRRule(r: Recurrence): string {
  const days = [...new Set(r.byDay)].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
  if (days.length === 0) throw new Error("byDay must contain at least one weekday");
  return `RRULE:FREQ=${r.freq};BYDAY=${days.join(",")};UNTIL=${toUtcBasic(r.until)}`;
}

/** Most occurrences a series may have, whoever expands it (Google enforces its own limits). */
export const MAX_SERIES_OCCURRENCES = 200;

/**
 * Expand a weekly series ourselves, for classes scheduled without Google. Each occurrence keeps the first class's
 * wall-clock time in `timeZone` (so 09:00 IST stays 09:00 IST), on every listed weekday from the first class's
 * date up to and including `until`'s date in that zone. The first class itself is always included.
 */
export function expandWeekly(
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
  r: Recurrence,
): { startsAt: Date; endsAt: Date }[] {
  const duration = endsAt.getTime() - startsAt.getTime();
  const [date, time] = utcToZonedInput(startsAt, timeZone).split("T") as [string, string];
  const lastDay = utcToZonedInput(r.until, timeZone).slice(0, 10);
  const days = new Set(r.byDay);
  const out = [{ startsAt, endsAt }];
  // Walk calendar dates as UTC midnights (pure date arithmetic, no time zone involved).
  for (let d = Date.parse(`${date}T00:00:00Z`) + 86_400_000; ; d += 86_400_000) {
    const key = new Date(d).toISOString().slice(0, 10);
    if (key > lastDay || out.length >= MAX_SERIES_OCCURRENCES) break;
    const weekday = WEEKDAYS[(new Date(d).getUTCDay() + 6) % 7]!; // getUTCDay: 0 = Sunday
    if (!days.has(weekday)) continue;
    const start = zonedInputToUtc(`${key}T${time}`, timeZone);
    out.push({ startsAt: start, endsAt: new Date(start.getTime() + duration) });
  }
  return out;
}
