"use client";

import { utcToZonedInput, zonedInputToUtc } from "@elearner/core/time";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export interface EditorQuestion {
  prompt: string;
  options: string[];
  correct: number[];
  points: number;
}

export interface QuizEditorValues {
  id?: string;
  title: string;
  timeLimitMinutes: number | null;
  dueAt: string | null;
  maxAttempts: number;
  shuffle: boolean;
  published: boolean;
  questions: EditorQuestion[];
  locked: boolean;
}

const inputCls = "h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]";
const iconBtn = "w-11 px-0!";
const blank = (): EditorQuestion => ({ prompt: "", options: ["", ""], correct: [], points: 1 });

/** Settings plus a list of multiple-choice questions. Questions are read-only once students have taken it. */
export function QuizEditor({
  courseId,
  initial,
  timeZone,
}: {
  courseId: string;
  initial?: QuizEditorValues;
  timeZone: string;
}) {
  const t = useTranslations("WorkEditor");
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [timeLimit, setTimeLimit] = useState(
    initial?.timeLimitMinutes ? String(initial.timeLimitMinutes) : "",
  );
  const [dueAt, setDueAt] = useState(
    initial?.dueAt ? utcToZonedInput(new Date(initial.dueAt), timeZone) : "",
  );
  const [maxAttempts, setMaxAttempts] = useState(String(initial?.maxAttempts ?? 1));
  const [shuffle, setShuffle] = useState(initial?.shuffle ?? true);
  const [published, setPublished] = useState(initial?.published ?? false);
  const [questions, setQuestions] = useState<EditorQuestion[]>(initial?.questions ?? [blank()]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const locked = initial?.locked ?? false;

  const update = (i: number, patch: Partial<EditorQuestion>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) =>
    setQuestions((qs) => {
      const out = [...qs];
      [out[i], out[i + d]] = [out[i + d]!, out[i]!];
      return out;
    });

  async function save() {
    setBusy(true);
    setError(null);
    setErrors({});
    const json = {
      title,
      timeLimitMinutes: timeLimit === "" ? undefined : Number(timeLimit),
      dueAt: dueAt ? zonedInputToUtc(dueAt, timeZone).toISOString() : undefined,
      maxAttempts: Number(maxAttempts),
      shuffle,
      published,
      questions,
    };
    try {
      const { id } = initial?.id
        ? await api<{ id: string }>(`/api/v1/quizzes/${initial.id}`, { method: "PUT", json })
        : await api<{ id: string }>(`/api/v1/courses/${courseId}/quizzes`, { method: "POST", json });
      router.push(`/quizzes/${id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) {
        setErrors(Object.fromEntries(err.fieldErrors.map((x) => [x.path, x.message])));
        setError(t("fixFields"));
      } else setError(err instanceof ApiError ? err.message : t("saveFailed"));
      setBusy(false);
    }
  }

  const err = (path: string) =>
    errors[path] ? <p className="text-[13px] text-live">{errors[path]}</p> : null;

  return (
    <div className="flex flex-col gap-6">
      {error && <FormAlert>{error}</FormAlert>}
      <section
        aria-labelledby="settings-h"
        className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="settings-h" className="font-display text-xl font-bold">
          {t("settings")}
        </h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quiz-title" className="text-sm font-semibold">
            {t("title")}
          </label>
          <input
            id="quiz-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            className={inputCls}
          />
          {err("title")}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="quiz-time" className="text-sm font-semibold">
              {t("timeLimit")}
            </label>
            <input
              id="quiz-time"
              type="number"
              inputMode="numeric"
              min={1}
              max={300}
              placeholder={t("noLimit")}
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
              className={inputCls}
            />
            {err("timeLimitMinutes")}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="quiz-attempts" className="text-sm font-semibold">
              {t("attempts")}
            </label>
            <input
              id="quiz-attempts"
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              className={inputCls}
            />
            {err("maxAttempts")}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="quiz-due" className="text-sm font-semibold">
              {t("closes")}
            </label>
            <input
              id="quiz-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={inputCls}
            />
            {err("dueAt")}
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={shuffle}
            onChange={(e) => setShuffle(e.target.checked)}
            className="size-5"
          />
          <span>{t("shuffle")}</span>
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="size-5"
          />
          <span>{t("visible")}</span>
        </label>
      </section>

      <section aria-labelledby="questions-h" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="questions-h" className="font-display text-xl font-bold">
            {t("questions", { count: questions.length })}
          </h2>
          <span className="text-sm text-muted">
            {t("pointsTotal", { count: questions.reduce((n, q) => n + (Number(q.points) || 0), 0) })}
          </span>
        </div>
        {locked && (
          <p role="status" className="rounded-[var(--radius-control)] bg-canvas px-3 py-2.5 text-sm">
            {t("locked")}
          </p>
        )}
        {err("questions")}
        {questions.map((q, i) => (
          <fieldset
            key={i}
            disabled={locked}
            className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5"
          >
            <legend className="sr-only">{t("questionN", { n: i + 1 })}</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">{t("questionN", { n: i + 1 })}</p>
              {!locked && (
                <div className="flex gap-1.5" role="group" aria-label={t("questionActions", { n: i + 1 })}>
                  <Button
                    variant="secondary"
                    className={iconBtn}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={t("moveUp", { n: i + 1 })}
                  >
                    <Icon name="arrowUp" size={18} />
                  </Button>
                  <Button
                    variant="secondary"
                    className={iconBtn}
                    disabled={i === questions.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={t("moveDown", { n: i + 1 })}
                  >
                    <Icon name="arrowDown" size={18} />
                  </Button>
                  <Button
                    variant="danger"
                    className={iconBtn}
                    disabled={questions.length === 1}
                    onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                    aria-label={t("deleteQuestion", { n: i + 1 })}
                  >
                    <Icon name="trash" size={18} />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`q${i}-prompt`} className="text-sm font-semibold">
                {t("question")}
              </label>
              <textarea
                id={`q${i}-prompt`}
                rows={2}
                maxLength={2000}
                value={q.prompt}
                onChange={(e) => update(i, { prompt: e.target.value })}
                className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px]"
              />
              {err(`questions.${i}.prompt`)}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold" id={`q${i}-options`}>
                {t("options")} <span className="font-normal text-muted">{t("optionsHint")}</span>
              </p>
              {q.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={q.correct.includes(k)}
                    onChange={(e) =>
                      update(i, {
                        correct: e.target.checked ? [...q.correct, k] : q.correct.filter((c) => c !== k),
                      })
                    }
                    aria-label={t("optionCorrect", { k: k + 1 })}
                    className="size-5 shrink-0"
                  />
                  <input
                    value={o}
                    onChange={(e) =>
                      update(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })
                    }
                    maxLength={500}
                    aria-label={t("optionLabel", { n: i + 1, k: k + 1 })}
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                  {!locked && q.options.length > 2 && (
                    <Button
                      variant="ghost"
                      className={iconBtn}
                      onClick={() =>
                        update(i, {
                          options: q.options.filter((_, j) => j !== k),
                          correct: q.correct.filter((c) => c !== k).map((c) => (c > k ? c - 1 : c)),
                        })
                      }
                      aria-label={t("removeOption", { k: k + 1 })}
                    >
                      <Icon name="close" size={18} />
                    </Button>
                  )}
                </div>
              ))}
              {err(`questions.${i}.options`)}
              {err(`questions.${i}.correct`)}
              {!locked && q.options.length < 6 && (
                <Button
                  variant="ghost"
                  className="w-fit px-2"
                  onClick={() => update(i, { options: [...q.options, ""] })}
                >
                  <Icon name="plus" size={18} />
                  {t("addOption")}
                </Button>
              )}
            </div>
            <div className="flex w-32 flex-col gap-1.5">
              <label htmlFor={`q${i}-points`} className="text-sm font-semibold">
                {t("points")}
              </label>
              <input
                id={`q${i}-points`}
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={q.points}
                onChange={(e) => update(i, { points: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </fieldset>
        ))}
        {!locked && (
          <Button
            variant="secondary"
            className="w-fit"
            onClick={() => setQuestions((qs) => [...qs, blank()])}
          >
            <Icon name="plus" size={18} />
            {t("addQuestion")}
          </Button>
        )}
      </section>

      <Button disabled={busy} onClick={() => void save()} className="w-fit">
        {busy ? t("saving") : initial?.id ? t("saveQuiz") : t("createQuiz")}
      </Button>
    </div>
  );
}
