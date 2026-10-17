"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export function SchoolSettingsForm({ dailyGoalMinutes }: { dailyGoalMinutes: number }) {
  const t = useTranslations("AdminSettings");
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
      setNote({ tone: "success", text: t("saved") });
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

  return (
    <form onSubmit={(e) => void save(e)} aria-label={t("formLabel")} className="flex flex-col gap-4">
      <div className="w-56">
        <Field
          label={t("goalLabel")}
          id="daily-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          inputMode="numeric"
          hint={t("goalHint")}
        />
      </div>
      <div aria-live="polite">{note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}</div>
      <Button type="submit" disabled={busy} className="w-fit">
        {busy ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
