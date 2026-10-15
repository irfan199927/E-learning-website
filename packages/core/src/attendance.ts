/**
 * Attendance from Meet participant sessions. A student can drop and rejoin, so we
 * merge overlapping intervals, clip them to the class window, and compare the total
 * with the class length.
 */

export interface Interval {
  start: Date;
  end: Date;
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .map((i) => ({ start: new Date(i.start), end: new Date(i.end) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out.at(-1);
    if (last && cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      out.push(cur);
    }
  }
  return out;
}

export interface AttendanceResult {
  joinedAt: Date | null;
  leftAt: Date | null;
  durationSeconds: number;
  present: boolean;
}

export function computeAttendance(
  sessions: Interval[],
  classWindow: Interval,
  presentRatio = 0.5,
): AttendanceResult {
  const clipped = mergeIntervals(
    sessions.map((s) => ({
      start: new Date(Math.max(s.start.getTime(), classWindow.start.getTime())),
      end: new Date(Math.min(s.end.getTime(), classWindow.end.getTime())),
    })),
  );
  const durationMs = clipped.reduce((sum, i) => sum + (i.end.getTime() - i.start.getTime()), 0);
  const classMs = classWindow.end.getTime() - classWindow.start.getTime();
  const raw = mergeIntervals(sessions);
  return {
    joinedAt: raw[0]?.start ?? null,
    leftAt: raw.at(-1)?.end ?? null,
    durationSeconds: Math.round(durationMs / 1000),
    present: classMs > 0 && durationMs / classMs >= presentRatio,
  };
}
