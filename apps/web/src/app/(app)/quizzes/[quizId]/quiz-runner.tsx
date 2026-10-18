"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import type { AttemptQuestion } from "@/server/services/quizzes";

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** One attempt: radio buttons (one answer) or checkboxes (several), a countdown, and auto-submit at zero. */
export function QuizRunner({
  attemptId,
  questions,
  deadline,
}: {
  attemptId: string;
  questions: AttemptQuestion[];
  deadline: string | null;
}) {
  const t = useTranslations("Quizzes");
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(
    deadline ? new Date(deadline).getTime() - Date.now() : null,
  );
  const [confirming, setConfirming] = useState(false);
  const sent = useRef(false);
  const unanswered = questions.filter((q) => !answers[q.id]?.length).length;

  const submit = useCallback(async () => {
    if (sent.current) return;
    sent.current = true;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/attempts/${attemptId}`, { method: "PUT", json: { answers } });
      router.refresh();
    } catch (err) {
      sent.current = false;
      setError(err instanceof ApiError ? err.message : t("submitFailed"));
      setBusy(false);
    }
  }, [answers, attemptId, router, t]);

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => {
      const ms = new Date(deadline).getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0) void submit();
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, submit]);

  const toggle = (q: AttemptQuestion, k: number) =>
    setAnswers((a) => {
      const cur = a[q.id] ?? [];
      return {
        ...a,
        [q.id]: q.multiple ? (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]) : [k],
      };
    });

  return (
    <div className="flex flex-col gap-5">
      {left !== null && (
        <div
          className={`sticky top-2 z-10 w-fit rounded-full border px-4 py-2 font-bold shadow-sm ${
            left < 60_000 ? "border-live bg-live-soft text-live-fg" : "border-line bg-surface"
          }`}
        >
          <span aria-hidden="true">{t("timeLeft", { time: clock(left) })}</span>
          {/* Announce once a minute, not every second. */}
          <span className="sr-only" aria-live="polite">
            {t("minutesLeft", { count: Math.ceil(left / 60_000) })}
          </span>
        </div>
      )}
      <ol className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <li key={q.id}>
            <fieldset className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <legend className="sr-only">{t("question", { n: i + 1 })}</legend>
              <p className="font-semibold">
                {i + 1}. {q.prompt}
              </p>
              <p className="text-sm text-muted">
                {t("points", { count: q.points })}
                {q.multiple && ` · ${t("chooseAll")}`}
              </p>
              {q.options.map((o, k) => (
                <label
                  key={k}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-line-strong px-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                >
                  <input
                    type={q.multiple ? "checkbox" : "radio"}
                    name={`q-${q.id}`}
                    checked={(answers[q.id] ?? []).includes(k)}
                    onChange={() => toggle(q, k)}
                    disabled={busy}
                    className="size-5 shrink-0"
                  />
                  <span>{o}</span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>
      {error && <FormAlert>{error}</FormAlert>}
      {confirming && unanswered > 0 ? (
        <div role="group" aria-label={t("confirmLabel")} className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{t("unanswered", { count: unanswered })}</span>
          <Button disabled={busy} onClick={() => void submit()}>
            {t("submit")}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            {t("keepGoing")}
          </Button>
        </div>
      ) : (
        <Button
          disabled={busy}
          className="w-fit"
          onClick={() => (unanswered > 0 ? setConfirming(true) : void submit())}
        >
          {busy ? t("submitting") : t("submitAnswers")}
        </Button>
      )}
    </div>
  );
}
