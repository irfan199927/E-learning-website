"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("CourseEditor");
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
      setNote({ tone: "success", text: t("removed", { name: row.name }) });
      setConfirming(null);
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
    <div className="flex flex-col gap-3">
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      {rows.length === 0 ? (
        <p className="text-muted">{t("noStudents")}</p>
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
                  {t("joined", { email: r.email, date: r.enrolledOn })}
                </p>
              </div>
              {confirming === r.userId ? (
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label={t("confirmRemove", { name: r.name })}
                >
                  <span className="text-sm">{t("removeQuestion", { name: r.name })}</span>
                  <Button variant="live" disabled={busy} onClick={() => void remove(r)}>
                    {t("remove")}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setConfirming(null)}>
                    {t("keep")}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => setConfirming(r.userId)}
                  aria-label={t("removeFromCourse", { name: r.name })}
                >
                  {t("remove")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
