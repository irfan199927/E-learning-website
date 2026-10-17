"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export function SchoolSettingsForm({ dailyGoalMinutes }: { dailyGoalMinutes: number }) {
  const router = useRouter();
  const [goal, setGoal] = useState(String(dailyGoalMinutes));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      await api("/api/v1/admin/settings", { method: "PUT", json: { dailyGoalMinutes: goal } });
      setNote({ tone: "success", text: "Saved. Students see the new goal on their Overview." });
      router.refresh();
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : "That didn't work. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} aria-label="School settings" className="flex flex-col gap-4">
      <div className="w-56">
        <Field
          label="Daily learning goal (minutes)"
          id="daily-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          inputMode="numeric"
          hint="The ring on each student's Today's progress fills at this many minutes of lessons."
        />
      </div>
      <div aria-live="polite">{note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}</div>
      <Button type="submit" disabled={busy} className="w-fit">
        {busy ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
