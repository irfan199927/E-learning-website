/**
 * Gradebook rules (no I/O): what each cell of a course gradebook says, how a student's total is worked out, and
 * the CSV export.
 *
 * Totals count work that is marked or overdue: a graded assignment or a taken quiz scores its points; an
 * assignment past its due date with nothing handed in (or a quiz past its closing date never taken) scores 0;
 * work handed in but not graded yet, and work not due yet, are left out until they are.
 */

export type GradeItemKind = "assignment" | "quiz";

export interface GradeItem {
  kind: GradeItemKind;
  id: string;
  title: string;
  maxPoints: number;
  dueAt: Date | null;
}

/**
 * graded        scored (assignment graded, or the best quiz attempt)
 * to-grade      handed in, waiting for the teacher
 * missing       overdue and nothing handed in / never taken: counts as 0
 * open          not due yet, nothing handed in
 */
export type GradeCellStatus = "graded" | "to-grade" | "missing" | "open";

export interface GradeCell {
  status: GradeCellStatus;
  score: number | null;
  late: boolean;
}

/** What we know about one student and one item. */
export interface GradeFacts {
  /** Assignment: the submission's state (null: nothing handed in). Quiz: "GRADED" once any attempt is in. */
  status: "SUBMITTED" | "LATE" | "GRADED" | "RETURNED" | null;
  score: number | null;
  late?: boolean;
}

export function gradeCell(item: GradeItem, facts: GradeFacts | undefined, now: Date): GradeCell {
  const late = facts?.late ?? facts?.status === "LATE";
  if (facts?.status === "GRADED" && facts.score !== null)
    return { status: "graded", score: facts.score, late };
  if (facts?.status) return { status: "to-grade", score: null, late };
  if (item.dueAt && item.dueAt < now) return { status: "missing", score: null, late: false };
  return { status: "open", score: null, late: false };
}

export interface GradeTotal {
  earned: number;
  possible: number;
  /** Rounded to one decimal; null when nothing counts yet. */
  percent: number | null;
}

export function gradeTotal(items: readonly GradeItem[], cells: readonly GradeCell[]): GradeTotal {
  let earned = 0;
  let possible = 0;
  items.forEach((item, i) => {
    const cell = cells[i];
    if (cell?.status === "graded") {
      earned += cell.score ?? 0;
      possible += item.maxPoints;
    } else if (cell?.status === "missing") {
      possible += item.maxPoints;
    }
  });
  return { earned, possible, percent: possible > 0 ? Math.round((earned / possible) * 1000) / 10 : null };
}

/** Mean of the scored cells (missing work counts as 0), rounded to one decimal; null when none count. */
export function itemAverage(cells: readonly GradeCell[]): number | null {
  const counted = cells.filter((c) => c.status === "graded" || c.status === "missing");
  if (counted.length === 0) return null;
  const sum = counted.reduce((n, c) => n + (c.score ?? 0), 0);
  return Math.round((sum / counted.length) * 10) / 10;
}

type CsvValue = string | number | null | undefined;

/**
 * RFC 4180 CSV with CRLF line ends and a UTF-8 byte order mark (so Excel reads Hindi names correctly).
 * Text starting with = + - @ or a control character is prefixed with ' so spreadsheets don't run it as a
 * formula (CSV injection).
 */
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  const cell = (v: CsvValue) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(v);
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
