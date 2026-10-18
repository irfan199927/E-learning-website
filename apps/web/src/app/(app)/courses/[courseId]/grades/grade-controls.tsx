"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { api, ApiError } from "@/lib/api-client";

const small =
  "inline-flex h-11 items-center rounded-[var(--radius-control)] px-2 text-xs font-semibold text-primary-fg hover:bg-primary-soft disabled:opacity-60";

/** Excuse a student from one item (left out of their total), or undo it. */
export function ExcuseButton({
  courseId,
  itemKind,
  itemId,
  itemTitle,
  userId,
  studentName,
  excused,
}: {
  courseId: string;
  itemKind: "assignment" | "quiz";
  itemId: string;
  itemTitle: string;
  userId: string;
  studentName: string;
  excused: boolean;
}) {
  const t = useTranslations("Grades");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function toggle() {
    setBusy(true);
    setError(false);
    try {
      await api(`/api/v1/courses/${courseId}/gradebook/excusals`, {
        method: "PUT",
        json: { itemKind, itemId, userId, excused: !excused },
      });
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      className={small}
      aria-label={t(excused ? "undoExcuseLabel" : "excuseLabel", { student: studentName, item: itemTitle })}
    >
      {error ? t("tryAgain") : excused ? t("undo") : t("excuse")}
    </button>
  );
}

/** By points, or assignments X% / quizzes the rest. */
export function WeightingForm({
  courseId,
  assignmentWeight,
}: {
  courseId: string;
  assignmentWeight: number | null;
}) {
  const t = useTranslations("Grades");
  const router = useRouter();
  const [mode, setMode] = useState<"points" | "weighted">(assignmentWeight === null ? "points" : "weighted");
  const [weight, setWeight] = useState(String(assignmentWeight ?? 50));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      await api(`/api/v1/courses/${courseId}/gradebook/weighting`, {
        method: "PUT",
        json: { assignmentWeight: mode === "points" ? null : Number(weight) },
      });
      setNote({ tone: "success", text: t("weightingSaved") });
      router.refresh();
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : t("failed"),
      });
    } finally {
      setBusy(false);
    }
  }

  const w = Math.min(100, Math.max(0, Number(weight) || 0));
  return (
    <form onSubmit={(e) => void save(e)} aria-label={t("weightingForm")} className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <legend className="mb-1 text-sm font-semibold">{t("howTotal")}</legend>
        <label className="flex h-11 items-center gap-2">
          <input
            type="radio"
            name="weighting"
            checked={mode === "points"}
            onChange={() => setMode("points")}
          />
          {t("byPoints")}
        </label>
        <label className="flex h-11 items-center gap-2">
          <input
            type="radio"
            name="weighting"
            checked={mode === "weighted"}
            onChange={() => setMode("weighted")}
          />
          {t("byCategory")}
        </label>
      </fieldset>
      {mode === "weighted" && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="assignment-weight" className="text-sm font-semibold">
            {t("assignments")}
          </label>
          <input
            id="assignment-weight"
            type="number"
            min={0}
            max={100}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="h-11 w-20 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3"
          />
          <span className="text-sm">{t("quizzesRest", { percent: 100 - w })}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-[15px] font-semibold hover:bg-hover disabled:opacity-60"
        >
          {busy ? t("saving") : t("saveWeighting")}
        </button>
        <div aria-live="polite">{note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}</div>
      </div>
    </form>
  );
}
