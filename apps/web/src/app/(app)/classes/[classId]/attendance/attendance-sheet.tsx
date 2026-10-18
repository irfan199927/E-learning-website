"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export interface SheetRow {
  userId: string;
  name: string;
  email: string;
  present: boolean | null;
  source: "MEET_API" | "MANUAL" | null;
  minutes: number;
  enrolled: boolean;
  recordingConsent: boolean;
}

/** One Present / Absent choice per student, "Mark everyone present", and Save. */
export function AttendanceSheet({ classId, rows }: { classId: string; rows: SheetRow[] }) {
  const t = useTranslations("Attendance");
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, boolean | null>>(
    Object.fromEntries(rows.map((r) => [r.userId, r.present])),
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const dirty = rows.some((r) => marks[r.userId] !== r.present);
  const unmarked = rows.filter((r) => marks[r.userId] === null).length;

  async function save() {
    const list = Object.entries(marks).flatMap(([userId, present]) =>
      present === null ? [] : [{ userId, present }],
    );
    if (list.length === 0) return setNote({ tone: "error", text: t("markOne") });
    setBusy(true);
    setNote(null);
    try {
      await api(`/api/v1/classes/${classId}/attendance`, { method: "PUT", json: { marks: list } });
      setNote({
        tone: "success",
        text: t("saved", { count: list.length }),
      });
      router.refresh();
    } catch (err) {
      setNote({ tone: "error", text: err instanceof ApiError ? err.message : t("saveFailed") });
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) return <p className="text-muted">{t("noStudents")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => setMarks(Object.fromEntries(rows.map((r) => [r.userId, true])))}
        >
          {t("markAll")}
        </Button>
        <span className="text-sm text-muted" aria-live="polite">
          {unmarked > 0 ? t("notMarked", { count: unmarked }) : t("allMarked")}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((r) => {
          const value = marks[r.userId];
          const group = `att-${r.userId}`;
          return (
            <li
              key={r.userId}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {r.name}
                  {!r.enrolled && (
                    <span className="ml-2 text-sm font-normal text-muted">{t("leftCourse")}</span>
                  )}
                  {!r.recordingConsent && (
                    <span className="ml-2 inline-block rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                      {t("noConsent")}
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-muted">
                  {r.email}
                  {r.source === "MEET_API" &&
                    ` · ${r.minutes ? t("fromMeetMinutes", { minutes: r.minutes }) : t("fromMeet")}`}
                  {r.source === "MANUAL" && ` · ${t("manual")}`}
                </p>
              </div>
              <fieldset className="flex gap-2">
                <legend className="sr-only">{r.name}</legend>
                {(
                  [
                    [
                      true,
                      t("present"),
                      "has-[:checked]:border-[#12805c] has-[:checked]:bg-success-soft has-[:checked]:text-[#0C6447]",
                    ],
                    [
                      false,
                      t("absent"),
                      "has-[:checked]:border-live has-[:checked]:bg-live-soft has-[:checked]:text-live-fg",
                    ],
                  ] as const
                ).map(([v, label, checked]) => (
                  <label
                    key={label}
                    className={`flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm font-semibold ${checked}`}
                  >
                    <input
                      type="radio"
                      name={group}
                      checked={value === v}
                      onChange={() => setMarks((m) => ({ ...m, [r.userId]: v }))}
                      className="size-4"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </li>
          );
        })}
      </ul>
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <Button disabled={busy || !dirty} onClick={() => void save()} className="w-fit">
        {busy ? t("saving") : t("save")}
      </Button>
    </div>
  );
}
