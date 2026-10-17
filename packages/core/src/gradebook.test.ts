import { describe, expect, it } from "vitest";
import { gradeCell, gradeTotal, itemAverage, toCsv, type GradeItem } from "./gradebook";

const now = new Date("2026-10-20T12:00:00Z");
const past = new Date("2026-10-19T12:00:00Z");
const future = new Date("2026-10-21T12:00:00Z");
const item = (id: string, maxPoints: number, dueAt: Date | null): GradeItem => ({
  kind: "assignment",
  id,
  title: id,
  maxPoints,
  dueAt,
});

describe("gradebook", () => {
  it("says what each cell is", () => {
    expect(gradeCell(item("a", 10, past), { status: "GRADED", score: 7 }, now)).toEqual({
      status: "graded",
      score: 7,
      late: false,
    });
    expect(gradeCell(item("a", 10, past), { status: "LATE", score: null }, now)).toEqual({
      status: "to-grade",
      score: null,
      late: true,
    });
    expect(gradeCell(item("a", 10, past), undefined, now).status).toBe("missing");
    expect(gradeCell(item("a", 10, future), undefined, now).status).toBe("open");
    expect(gradeCell(item("q", 5, null), undefined, now).status).toBe("open"); // quiz with no closing date
  });

  it("totals graded and overdue work only", () => {
    const items = [item("a", 10, past), item("b", 20, past), item("c", 10, past), item("d", 10, future)];
    const cells = [
      gradeCell(items[0]!, { status: "GRADED", score: 8 }, now),
      gradeCell(items[1]!, undefined, now), // missing → 0/20
      gradeCell(items[2]!, { status: "SUBMITTED", score: null }, now), // not graded yet → left out
      gradeCell(items[3]!, undefined, now), // not due → left out
    ];
    expect(gradeTotal(items, cells)).toEqual({ earned: 8, possible: 30, percent: 26.7 });
    expect(gradeTotal(items.slice(3), cells.slice(3))).toEqual({ earned: 0, possible: 0, percent: null });
    expect(itemAverage([cells[0]!, gradeCell(items[0]!, undefined, now)])).toBe(4);
    expect(itemAverage([cells[2]!, cells[3]!])).toBeNull();
  });

  it("writes CSV that spreadsheets can't run as formulas", () => {
    expect(
      toCsv([
        ["Name", "Score"],
        ['Rao, "Ravi"', 7],
        ["=HYPERLINK(1)", null],
        ["-2+3", 0],
      ]),
    ).toBe('\uFEFFName,Score\r\n"Rao, ""Ravi""",7\r\n\'=HYPERLINK(1),\r\n\'-2+3,0\r\n');
  });

  it("leaves excused work out, and weighs categories when asked", () => {
    expect(gradeCell(item("a", 10, past), { status: null, score: null, excused: true }, now).status).toBe(
      "excused",
    );
    const quiz = (id: string, max: number): GradeItem => ({ ...item(id, max, past), kind: "quiz" });
    const items = [item("a", 10, past), item("b", 10, past), quiz("q", 5)];
    const cells = [
      gradeCell(items[0]!, { status: "GRADED", score: 10 }, now), // assignments: 10/10 = 100%
      gradeCell(items[1]!, { status: null, score: null, excused: true }, now), // excused: left out
      gradeCell(items[2]!, { status: "GRADED", score: 1 }, now), // quizzes: 1/5 = 20%
    ];
    expect(gradeTotal(items, cells)).toEqual({ earned: 11, possible: 15, percent: 73.3 }); // by points
    expect(gradeTotal(items, cells, 60)).toEqual({ earned: 11, possible: 15, percent: 68 }); // 0.6×100 + 0.4×20
    expect(gradeTotal(items.slice(0, 1), cells.slice(0, 1), 60).percent).toBe(100); // no quizzes yet: assignments only
    expect(itemAverage([cells[1]!])).toBeNull();
  });
});
