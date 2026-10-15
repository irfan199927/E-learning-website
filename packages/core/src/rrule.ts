/** Build the RFC 5545 RRULE line that Google Calendar expects for recurring classes. */

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
