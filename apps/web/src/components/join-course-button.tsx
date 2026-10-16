"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

type State = "pending" | "declined" | "none";

/** "Ask to join" on a catalog course. The teacher approves the request before the course opens. */
export function JoinCourseButton({
  courseId,
  title,
  state,
}: {
  courseId: string;
  title: string;
  state: State;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<State>(state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/courses/${courseId}/join-requests`, { method: "POST", json: {} });
      setCurrent("pending");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (current === "pending")
    return (
      <p role="status" className="inline-flex h-11 items-center text-sm font-semibold text-muted">
        Request sent. Waiting for your teacher.
      </p>
    );

  return (
    <div className="flex flex-col items-end gap-2">
      {current === "declined" && <p className="text-sm text-muted">Your last request was declined.</p>}
      <Button onClick={ask} disabled={busy} aria-label={`Ask to join ${title}`} className="min-w-44">
        {busy ? "Sending…" : current === "declined" ? "Ask again" : "Ask to join"}
      </Button>
      {error && <FormAlert>{error}</FormAlert>}
    </div>
  );
}
