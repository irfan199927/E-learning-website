"use client";

import { COURSE_COLORS } from "@elearner/core/schemas";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export interface CourseDetails {
  id: string;
  title: string;
  grade: string | null;
  description: string | null;
  color: string;
  listed: boolean;
}

export function CourseDetailsForm({ course }: { course: CourseDetails }) {
  const t = useTranslations("CourseEditor");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    setFieldErrors({});
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/v1/courses/${course.id}`, {
        method: "PATCH",
        json: {
          title: String(f.get("title") ?? ""),
          grade: String(f.get("grade") ?? ""),
          description: String(f.get("description") ?? ""),
          color: String(f.get("color") ?? course.color),
          listed: f.get("listed") === "on",
        },
      });
      setNote({ tone: "success", text: t("saved") });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length)
        setFieldErrors(Object.fromEntries(err.fieldErrors.map((x) => [x.path, x.message])));
      else setNote({ tone: "error", text: err instanceof ApiError ? err.message : t("saveFailed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <Field
        id="title"
        name="title"
        label={t("courseTitle")}
        defaultValue={course.title}
        required
        maxLength={120}
        error={fieldErrors.title}
      />
      <Field
        id="grade"
        name="grade"
        label={t("grade")}
        defaultValue={course.grade ?? ""}
        maxLength={20}
        error={fieldErrors.grade}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-semibold">
          {t("description")}
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={course.description ?? ""}
          className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px]"
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold">{t("cardColour")}</legend>
        <div className="flex flex-wrap gap-2">
          {COURSE_COLORS.map((c) => (
            <label
              key={c.value}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-line-strong px-3 has-[:checked]:border-2 has-[:checked]:border-ink"
            >
              <input
                type="radio"
                name="color"
                value={c.value}
                defaultChecked={c.value === course.color}
                className="sr-only"
              />
              <span className="size-5 rounded-full" style={{ background: c.value }} aria-hidden="true" />
              <span className="text-sm">{t(`colors.${c.name}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          name="listed"
          defaultChecked={course.listed}
          className="mt-1 size-5 shrink-0"
        />
        <span>
          <span className="font-semibold">{t("listed")}</span>
          <span className="block text-sm text-muted">{t("listedHelp")}</span>
        </span>
      </label>
      <Button type="submit" disabled={busy} className="w-fit">
        {busy ? t("saving") : t("saveDetails")}
      </Button>
    </form>
  );
}
