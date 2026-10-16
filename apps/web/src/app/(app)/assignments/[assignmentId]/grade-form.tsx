"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/** Score + feedback for one submission. */
export function GradeForm({
  submissionId,
  studentName,
  maxPoints,
  score,
  feedback,
}: {
  submissionId: string;
  studentName: string;
  maxPoints: number;
  score: number | null;
  feedback: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const id = (k: string) => `${k}-${submissionId}`;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setNote(null);
    try {
      await api(`/api/v1/submissions/${submissionId}/grade`, {
        method: "PATCH",
        json: { score: Number(f.get("score")), feedback: String(f.get("feedback") ?? "") },
      });
      setNote({ tone: "success", text: `Saved. ${studentName} can see the grade now.` });
      router.refresh();
    } catch (err) {
      setNote({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn't save. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate aria-label={`Grade ${studentName}`}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={id("score")} className="text-sm font-semibold">
            Score (out of {maxPoints})
          </label>
          <input
            id={id("score")}
            name="score"
            type="number"
            inputMode="numeric"
            min={0}
            max={maxPoints}
            required
            defaultValue={score ?? ""}
            className="h-11 w-28 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]"
          />
        </div>
        <div className="flex min-w-60 flex-1 flex-col gap-1">
          <label htmlFor={id("feedback")} className="text-sm font-semibold">
            Feedback (optional)
          </label>
          <input
            id={id("feedback")}
            name="feedback"
            maxLength={10000}
            defaultValue={feedback ?? ""}
            className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]"
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : score === null ? "Save grade" : "Update grade"}
        </Button>
      </div>
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
    </form>
  );
}
