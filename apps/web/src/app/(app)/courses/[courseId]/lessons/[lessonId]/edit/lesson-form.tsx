"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { MarkdownField } from "@/components/markdown-field";

export interface LessonFormData {
  id: string;
  courseId: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  moduleId: string;
  published: boolean;
  modules: { id: string; title: string }[];
}

const inputCls = "h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]";

export function LessonForm({ lesson }: { lesson: LessonFormData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    setFieldErrors({});
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    try {
      await api(`/api/v1/lessons/${lesson.id}`, {
        method: "PATCH",
        json: {
          title: text("title"),
          ...(lesson.type === "VIDEO" ? {} : { body: text("body") }),
          ...(lesson.type === "LINK" ? { url: text("url") } : {}),
          moduleId: text("moduleId"),
          published: f.get("published") === "on",
        },
      });
      setNote({ tone: "success", text: "Saved." });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length)
        setFieldErrors(Object.fromEntries(err.fieldErrors.map((x) => [x.path, x.message])));
      else
        setNote({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn't save. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/v1/lessons/${lesson.id}`, { method: "DELETE" });
      router.push(`/courses/${lesson.courseId}/edit`);
      router.refresh();
    } catch (err) {
      setNote({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn't delete. Try again." });
      setBusy(false);
    }
  }

  const err = (k: string) =>
    fieldErrors[k] ? (
      <p id={`${k}-error`} className="text-[13px] text-live">
        {fieldErrors[k]}
      </p>
    ) : null;

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-semibold">
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={lesson.title}
          required
          maxLength={160}
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby={fieldErrors.title ? "title-error" : undefined}
          className={inputCls}
        />
        {err("title")}
      </div>
      {lesson.type === "LINK" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="url" className="text-sm font-semibold">
            Web address
          </label>
          <input
            id="url"
            name="url"
            type="url"
            inputMode="url"
            defaultValue={lesson.url ?? ""}
            required
            maxLength={2000}
            aria-invalid={fieldErrors.url ? true : undefined}
            aria-describedby={fieldErrors.url ? "url-error" : undefined}
            className={inputCls}
          />
          {err("url")}
        </div>
      )}
      {lesson.type !== "VIDEO" && (
        <MarkdownField
          id="body"
          name="body"
          label={lesson.type === "NOTE" ? "Text" : "Instructions (optional)"}
          rows={lesson.type === "NOTE" ? 12 : 4}
          defaultValue={lesson.body}
          error={fieldErrors.body}
        />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="moduleId" className="text-sm font-semibold">
          Module
        </label>
        <select id="moduleId" name="moduleId" defaultValue={lesson.moduleId} className={inputCls}>
          {lesson.modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          name="published"
          defaultChecked={lesson.published}
          className="mt-1 size-5 shrink-0"
        />
        <span>
          <span className="font-semibold">Visible to students</span>
          <span className="block text-sm text-muted">Untick to hide the lesson while you work on it.</span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save lesson"}
        </Button>
        {confirmDelete ? (
          <span
            role="group"
            aria-label="Confirm deleting this lesson"
            className="flex flex-wrap items-center gap-2"
          >
            <Button variant="live" disabled={busy} onClick={() => void remove()}>
              Delete lesson
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </span>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
            Delete…
          </Button>
        )}
      </div>
    </form>
  );
}
