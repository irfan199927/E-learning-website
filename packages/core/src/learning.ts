/**
 * Learner-progress rules: day keys, streaks, month grids, course progress state.
 * Pure and browser-safe (no node: imports) — exported as `@elearner/core/learning`.
 */

/** Calendar day of `date` in `timeZone`, as "YYYY-MM-DD". A student's day follows their own clock. */
export function localDayKey(date: Date, timeZone: string): string {
  // en-CA formats as ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "2026-10-16" → the UTC-midnight Date Postgres stores for a `@db.Date` column. */
export function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function dateToDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(key: string, days: number): string {
  const d = dayKeyToDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToDayKey(d);
}

/**
 * Consecutive active days ending today. A streak is still alive if the learner was active
 * yesterday but not yet today (they have until midnight to keep it).
 */
export function learningStreak(activeDays: Iterable<string>, today: string): number {
  const days = new Set(activeDays);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface MonthCell {
  key: string;
  day: number;
}

/**
 * Weeks of a month, Monday first (Indian school week). Empty slots before the 1st and after
 * the last day are `null`, so every row has exactly 7 cells.
 */
export function monthGrid(year: number, month: number): (MonthCell | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const cells: (MonthCell | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (MonthCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "2026-10" ± n months. Returns null for malformed input so callers can fall back to "this month". */
export function shiftMonth(ym: string, delta: number): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export type CourseProgressState = "not-started" | "in-progress" | "completed";

export function courseProgressState(total: number, completed: number, started: number): CourseProgressState {
  if (total > 0 && completed >= total) return "completed";
  if (started > 0 || completed > 0) return "in-progress";
  return "not-started";
}

/** Whole-number percentage, clamped to 0–100; 0 when there is nothing to complete. */
export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}
