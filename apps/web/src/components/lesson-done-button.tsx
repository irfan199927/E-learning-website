"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/** A student ticks a reading, link or file lesson as done (videos complete by watching). */
export function LessonDoneButton({ lessonId, done }: { lessonId: string; done: boolean }) {
  const router = useRouter();
  const [isDone, setDone] = useState(done);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/lessons/${lessonId}/progress`, { method: isDone ? "DELETE" : "PUT" });
      setDone(!isDone);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <FormAlert>{error}</FormAlert>}
      <Button
        variant={isDone ? "secondary" : "primary"}
        disabled={busy}
        onClick={() => void toggle()}
        aria-pressed={isDone}
        className="w-fit"
      >
        <Icon name="check" size={18} />
        {isDone ? "Done · undo" : "Mark as done"}
      </Button>
    </div>
  );
}
