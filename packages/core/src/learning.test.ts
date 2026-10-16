import { describe, expect, it } from "vitest";
import { courseProgressState, learningStreak, localDayKey, monthGrid, percent, shiftMonth } from "./learning";

describe("learning", () => {
  it("keys days on the learner's clock, not UTC", () => {
    // 20:00 UTC on the 15th is already 01:30 on the 16th in India.
    expect(localDayKey(new Date("2026-10-15T20:00:00Z"), "Asia/Kolkata")).toBe("2026-10-16");
    expect(localDayKey(new Date("2026-10-15T20:00:00Z"), "UTC")).toBe("2026-10-15");
  });

  it("counts a streak ending today, or yesterday if today has no activity yet", () => {
    const days = ["2026-10-13", "2026-10-14", "2026-10-15"];
    expect(learningStreak(days, "2026-10-15")).toBe(3);
    expect(learningStreak(days, "2026-10-16")).toBe(3); // still alive until midnight
    expect(learningStreak(days, "2026-10-17")).toBe(0); // missed a whole day
    expect(learningStreak([], "2026-10-16")).toBe(0);
    expect(learningStreak(["2026-10-01", "2026-10-03"], "2026-10-03")).toBe(1);
    // across a month boundary
    expect(learningStreak(["2026-09-30", "2026-10-01"], "2026-10-01")).toBe(2);
  });

  it("lays out a month Monday-first with full weeks", () => {
    const oct = monthGrid(2026, 10); // 1 Oct 2026 is a Thursday
    expect(oct[0]!.slice(0, 3)).toEqual([null, null, null]);
    expect(oct[0]![3]).toEqual({ key: "2026-10-01", day: 1 });
    expect(oct.every((w) => w.length === 7)).toBe(true);
    expect(oct.flat().filter(Boolean)).toHaveLength(31);
    expect(monthGrid(2026, 2).flat().filter(Boolean)).toHaveLength(28);
  });

  it("shifts months across years and rejects junk", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-13", 0)).toBeNull();
    expect(shiftMonth("../etc", 0)).toBeNull();
  });

  it("derives course state and percentages", () => {
    expect(courseProgressState(0, 0, 0)).toBe("not-started");
    expect(courseProgressState(5, 0, 1)).toBe("in-progress");
    expect(courseProgressState(5, 5, 5)).toBe("completed");
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
    expect(percent(9, 4)).toBe(100);
  });
});
