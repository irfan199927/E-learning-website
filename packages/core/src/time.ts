/** Time rules for live classes. Pure functions: pass `now` explicitly so they are testable. */

export type JoinState = { state: "not-yet"; opensAt: Date } | { state: "open" } | { state: "ended" };

/** Students may join from `openMinutesBefore` before start until the class ends. */
export function joinWindow(startsAt: Date, endsAt: Date, now: Date, openMinutesBefore = 10): JoinState {
  const opensAt = new Date(startsAt.getTime() - openMinutesBefore * 60_000);
  if (now >= endsAt) return { state: "ended" };
  if (now < opensAt) return { state: "not-yet", opensAt };
  return { state: "open" };
}

export const REMINDER_OFFSETS = [
  { kind: "24h", ms: 24 * 60 * 60_000 },
  { kind: "15m", ms: 15 * 60_000 },
] as const;
export type ReminderKind = (typeof REMINDER_OFFSETS)[number]["kind"];

/** Which reminders are still in the future, and how long until each fires. */
export function reminderSchedule(
  startsAt: Date,
  now: Date,
): { kind: ReminderKind; fireAt: Date; delayMs: number }[] {
  return REMINDER_OFFSETS.map(({ kind, ms }) => {
    const fireAt = new Date(startsAt.getTime() - ms);
    return { kind, fireAt, delayMs: fireAt.getTime() - now.getTime() };
  }).filter((r) => r.delayMs > 0);
}

/** Format an instant in a user's timezone, e.g. "Wed, 14 Oct, 3:00 pm". */
export function formatInZone(date: Date, timeZone: string, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function zonedParts(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
}

/** Offset of `timeZone` from UTC at `date`, in ms (IST → +19 800 000). */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-14T15:00" (wall clock in `timeZone`) → UTC instant. Handles DST transitions. */
export function zonedInputToUtc(local: string, timeZone: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return new Date(Number.NaN);
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  const first = guess - timeZoneOffsetMs(new Date(guess), timeZone);
  const second = guess - timeZoneOffsetMs(new Date(first), timeZone);
  return new Date(second);
}

/** UTC instant → "YYYY-MM-DDTHH:mm" wall clock in `timeZone` (for <input type="datetime-local">). */
export function utcToZonedInput(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const pad = (n: number | undefined) => String(n ?? 0).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
