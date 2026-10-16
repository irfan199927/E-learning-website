"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export interface RosterRow {
  userId: string;
  name: string;
  email: string;
  enrolledOn: string;
}

/** A course's students for its teacher, with Remove (asks to confirm first). */
export function RosterList({ courseId, students }: { courseId: string; students: RosterRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(students);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function remove(row: RosterRow) {
    setBusy(true);
    setNote(null);
    try {
      await api(`/api/v1/courses/${courseId}/students/${row.userId}`, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.userId !== row.userId));
      setNote({ tone: "success", text: `Removed ${row.name}. They can ask to join again.` });
      setConfirming(null);
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
    <div className="flex flex-col gap-3">
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      {rows.length === 0 ? (
        <p className="text-muted">No students yet. Approve join requests above to add them.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((r) => (
            <li
              key={r.userId}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">{r.name}</p>
                <p className="truncate text-sm text-muted">
                  {r.email} · joined {r.enrolledOn}
                </p>
              </div>
              {confirming === r.userId ? (
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label={`Confirm removing ${r.name}`}
                >
                  <span className="text-sm">Remove {r.name}?</span>
                  <Button variant="live" disabled={busy} onClick={() => void remove(r)}>
                    Remove
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setConfirming(null)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirming(r.userId)}
                  aria-label={`Remove ${r.name} from this course`}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
