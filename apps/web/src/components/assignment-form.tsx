"use client";

import { utcToZonedInput, zonedInputToUtc } from "@elearner/core/time";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { MarkdownField } from "./markdown-field";

export interface AssignmentFormValues {
  id: string;
  title: string;
  instructions: string;
  dueAt: string;
  maxPoints: number;
  allowText: boolean;
  allowFile: boolean;
  allowLate: boolean;
  published: boolean;
}

/** Create (with `courseId`) or edit (with `assignment`) an assignment. Dates are on the teacher's clock. */
export function AssignmentForm({
  courseId,
  assignment,
  timeZone,
}: {
  courseId: string;
  assignment?: AssignmentFormValues;
  timeZone: string;
}) {
  const t = useTranslations("WorkEditor");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const defaultDue = assignment
    ? utcToZonedInput(new Date(assignment.dueAt), timeZone)
    : `${utcToZonedInput(new Date(Date.now() + 7 * 86_400_000), timeZone).slice(0, 10)}T23:59`;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const f = new FormData(e.currentTarget);
    const json = {
      title: String(f.get("title") ?? "").trim(),
      instructions: String(f.get("instructions") ?? "").trim(),
      dueAt: zonedInputToUtc(String(f.get("dueAt")), timeZone).toISOString(),
      maxPoints: Number(f.get("maxPoints")),
      allowText: f.get("allowText") === "on",
      allowFile: f.get("allowFile") === "on",
      allowLate: f.get("allowLate") === "on",
      published: f.get("published") === "on",
    };
    try {
      const { id } = assignment
        ? await api<{ id: string }>(`/api/v1/assignments/${assignment.id}`, { method: "PATCH", json })
        : await api<{ id: string }>(`/api/v1/courses/${courseId}/assignments`, { method: "POST", json });
      router.push(`/assignments/${id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length)
        setFieldErrors(Object.fromEntries(err.fieldErrors.map((x) => [x.path, x.message])));
      else setError(err instanceof ApiError ? err.message : t("saveFailed"));
      setBusy(false);
    }
  }

  const check = (name: keyof AssignmentFormValues, label: string, hint: string, def: boolean) => (
    <label className="flex min-h-11 items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={def} className="mt-1 size-5 shrink-0" />
      <span>
        <span className="font-semibold">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <FormAlert>{error}</FormAlert>}
      <Field
        id="title"
        name="title"
        label={t("title")}
        required
        maxLength={160}
        defaultValue={assignment?.title}
        error={fieldErrors.title}
      />
      <MarkdownField
        id="instructions"
        name="instructions"
        label={t("instructions")}
        rows={8}
        required
        defaultValue={assignment?.instructions}
        error={fieldErrors.instructions}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="dueAt"
          name="dueAt"
          type="datetime-local"
          label={t("due")}
          required
          defaultValue={defaultDue}
          hint={t("timesIn", { zone: timeZone })}
          error={fieldErrors.dueAt}
        />
        <Field
          id="maxPoints"
          name="maxPoints"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          label={t("points")}
          required
          defaultValue={assignment?.maxPoints ?? 100}
          error={fieldErrors.maxPoints}
        />
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">{t("studentsHandIn")}</legend>
        {check("allowText", t("allowText"), t("allowTextHint"), assignment?.allowText ?? true)}
        {check("allowFile", t("allowFile"), t("allowFileHint"), assignment?.allowFile ?? true)}
        {fieldErrors.allowText && <p className="text-[13px] text-live">{fieldErrors.allowText}</p>}
      </fieldset>
      {check("allowLate", t("allowLate"), t("allowLateHint"), assignment?.allowLate ?? false)}
      {check("published", t("visible"), t("visibleHint"), assignment?.published ?? true)}
      <Button type="submit" disabled={busy} className="w-fit">
        {busy ? t("saving") : assignment ? t("saveChanges") : t("createAssignment")}
      </Button>
    </form>
  );
}
