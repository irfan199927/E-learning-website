"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export function CreateCourseForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? "").trim() || undefined;
    try {
      const { id } = await api<{ id: string }>("/api/v1/courses", {
        method: "POST",
        json: { title: text("title"), grade: text("grade"), description: text("description") },
      });
      router.push(`/courses/${id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length)
        setFieldErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
      else setError(err instanceof ApiError ? err.message : "Couldn't create the course. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <FormAlert>{error}</FormAlert>}
      <Field
        id="title"
        name="title"
        label="Course title"
        required
        maxLength={120}
        error={fieldErrors.title}
      />
      <Field
        id="grade"
        name="grade"
        label="Class or grade (optional)"
        maxLength={20}
        hint="For example 9-A. Shown on the course card."
        error={fieldErrors.grade}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-semibold">
          What students will learn (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px]"
        />
      </div>
      <Button type="submit" disabled={busy} className="w-fit">
        {busy ? "Creating…" : "Create course"}
      </Button>
    </form>
  );
}
