/**
 * Gradebook rules (no I/O): what each cell of a course gradebook says, how a student's total is worked out, and
 * the CSV export.
 *
 * Totals count work that is marked or overdue: a graded assignment or a taken quiz scores its points; an
 * assignment past its due date with nothing handed in (or a quiz past its closing date never taken) scores 0;
 * work handed in but not graded yet, and work not due yet, are left out until they are. Work a teacher excused
 * is always left out.
 *
 * Weighting: by points (the default), or a course can give assignments a share of the total in percent (quizzes
 * get the rest); the total is then the weighted mix of the two categories' percentages (a category with nothing
 * counted yet is left out of the mix).
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
 * excused       the teacher excused this student from it: left out of totals and averages
 */
export type GradeCellStatus = "graded" | "to-grade" | "missing" | "open" | "excused";

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
  excused?: boolean;
}

export function gradeCell(item: GradeItem, facts: GradeFacts | undefined, now: Date): GradeCell {
  if (facts?.excused) return { status: "excused", score: null, late: false };
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

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * `assignmentWeight`: assignments' share of the total in percent (0–100), or null to weigh by points.
 * `earned`/`possible` are always raw points; only `percent` is weighted.
 */
export function gradeTotal(
  items: readonly GradeItem[],
  cells: readonly GradeCell[],
  assignmentWeight: number | null = null,
): GradeTotal {
  const sums = { assignment: { earned: 0, possible: 0 }, quiz: { earned: 0, possible: 0 } };
  items.forEach((item, i) => {
    const cell = cells[i];
    const sum = sums[item.kind];
    if (cell?.status === "graded") {
      sum.earned += cell.score ?? 0;
      sum.possible += item.maxPoints;
    } else if (cell?.status === "missing") {
      sum.possible += item.maxPoints;
    }
  });
  const earned = sums.assignment.earned + sums.quiz.earned;
  const possible = sums.assignment.possible + sums.quiz.possible;
  if (possible === 0) return { earned, possible, percent: null };
  if (assignmentWeight === null) return { earned, possible, percent: round1((earned / possible) * 100) };
  const parts = [
    { weight: assignmentWeight, ...sums.assignment },
    { weight: 100 - assignmentWeight, ...sums.quiz },
  ].filter((p) => p.possible > 0 && p.weight > 0);
  const weights = parts.reduce((n, p) => n + p.weight, 0);
  if (weights === 0) return { earned, possible, percent: round1((earned / possible) * 100) };
  const percent = parts.reduce((n, p) => n + (p.earned / p.possible) * 100 * (p.weight / weights), 0);
  return { earned, possible, percent: round1(percent) };
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
