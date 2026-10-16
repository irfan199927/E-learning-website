/**
 * Pure rules for assignments and MCQ quizzes (no I/O): late submissions, quiz scoring, question order and the
 * time limit. Used by the web services and tests.
 */

export const MAX_SUBMISSION_FILES = 5;
export const SUBMISSION_FILE_MAX_BYTES = 25 * 1024 * 1024;
/** Extra seconds allowed after a quiz's time limit, for the network and the auto-submit. */
export const QUIZ_GRACE_SECONDS = 60;

/** Status a new submission gets: on time, late (when allowed), or refused. */
export function submissionTiming(dueAt: Date, now: Date, allowLate: boolean): "on-time" | "late" | "closed" {
  if (now <= dueAt) return "on-time";
  return allowLate ? "late" : "closed";
}

export interface QuizQuestionKey {
  id: string;
  correct: number[];
  points: number;
}

/** answers: { [questionId]: option indexes }. A question scores its points only when the chosen set is exactly right. */
export function scoreQuiz(
  questions: QuizQuestionKey[],
  answers: Record<string, number[]>,
): { score: number; max: number; correctIds: string[] } {
  let score = 0;
  const correctIds: string[] = [];
  for (const q of questions) {
    const chosen = [...new Set(answers[q.id] ?? [])].sort((a, b) => a - b);
    const right = [...new Set(q.correct)].sort((a, b) => a - b);
    if (chosen.length === right.length && chosen.every((v, i) => v === right[i])) {
      score += q.points;
      correctIds.push(q.id);
    }
  }
  return { score, max: questions.reduce((n, q) => n + q.points, 0), correctIds };
}

/** Deterministic shuffle (same seed → same order), so a student sees one stable order per attempt. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** When a timed attempt must be in by (null: untimed). */
export function attemptDeadline(startedAt: Date, timeLimitSec: number | null): Date | null {
  return timeLimitSec ? new Date(startedAt.getTime() + timeLimitSec * 1000) : null;
}
