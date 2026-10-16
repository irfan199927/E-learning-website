import { describe, expect, it } from "vitest";
import { attemptDeadline, scoreQuiz, seededShuffle, submissionTiming } from "./grading";
import { saveQuizSchema } from "./schemas";

describe("grading", () => {
  it("scores a question only when exactly the right options are chosen", () => {
    const qs = [
      { id: "a", correct: [1], points: 2 },
      { id: "b", correct: [0, 2], points: 3 },
      { id: "c", correct: [3], points: 1 },
    ];
    expect(scoreQuiz(qs, { a: [1], b: [2, 0, 2], c: [2] })).toEqual({
      score: 5,
      max: 6,
      correctIds: ["a", "b"],
    });
    expect(scoreQuiz(qs, { b: [0] }).score).toBe(0); // half-right multi-select scores nothing
    expect(scoreQuiz(qs, {}).score).toBe(0);
  });

  it("shuffles deterministically per seed", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(seededShuffle(items, "attempt-1")).toEqual(seededShuffle(items, "attempt-1"));
    expect(seededShuffle(items, "attempt-1")).not.toEqual(seededShuffle(items, "attempt-2"));
    expect([...seededShuffle(items, "x")].sort((a, b) => a - b)).toEqual(items);
  });

  it("knows late submissions and time limits", () => {
    const due = new Date("2026-10-20T18:29:00Z");
    expect(submissionTiming(due, new Date("2026-10-20T18:00:00Z"), false)).toBe("on-time");
    expect(submissionTiming(due, new Date("2026-10-21T00:00:00Z"), true)).toBe("late");
    expect(submissionTiming(due, new Date("2026-10-21T00:00:00Z"), false)).toBe("closed");
    expect(attemptDeadline(new Date("2026-10-20T10:00:00Z"), 600)?.toISOString()).toBe(
      "2026-10-20T10:10:00.000Z",
    );
    expect(attemptDeadline(new Date(), null)).toBeNull();
  });

  it("validates quiz questions", () => {
    const base = {
      title: "Fractions",
      questions: [{ prompt: "1/2 + 1/2?", options: ["1", "2"], correct: [0] }],
    };
    expect(saveQuizSchema.safeParse(base).success).toBe(true);
    const bad = saveQuizSchema.safeParse({
      ...base,
      questions: [{ prompt: "?", options: ["1", "2"], correct: [5] }],
    });
    expect(bad.success).toBe(false);
    expect(saveQuizSchema.parse({ ...base, timeLimitMinutes: "", dueAt: "" })).toMatchObject({
      timeLimitMinutes: undefined,
      dueAt: undefined,
      maxAttempts: 1,
    });
  });
});
