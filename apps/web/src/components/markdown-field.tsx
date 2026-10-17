"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Markdown } from "./markdown";

/**
 * A textarea for Markdown with a Preview toggle. The textarea stays in the form (hidden while previewing), so
 * forms that read FormData keep working.
 */
export function MarkdownField({
  id,
  name,
  label,
  rows = 6,
  defaultValue,
  required = false,
  maxLength = 20000,
  error,
}: {
  id: string;
  name: string;
  label: string;
  rows?: number;
  defaultValue?: string | null;
  required?: boolean;
  maxLength?: number;
  error?: string;
}) {
  const t = useTranslations("LessonEditor");
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const describedBy = [`${id}-hint`, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <button
          type="button"
          aria-pressed={preview !== null}
          onClick={() => setPreview((p) => (p === null ? (ref.current?.value ?? "") : null))}
          className="h-11 rounded-[var(--radius-control)] px-3 text-sm font-semibold text-primary-fg hover:bg-primary-soft"
        >
          {preview === null ? t("preview") : t("backToEditing")}
        </button>
      </div>
      <textarea
        ref={ref}
        id={id}
        name={name}
        rows={rows}
        maxLength={maxLength}
        required={required && preview === null}
        defaultValue={defaultValue ?? ""}
        hidden={preview !== null}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px]"
      />
      {preview !== null && (
        <div
          className="min-h-24 rounded-[var(--radius-control)] border border-line bg-canvas px-4 py-1"
          aria-live="polite"
        >
          {preview.trim() ? (
            <Markdown>{preview}</Markdown>
          ) : (
            <p className="my-3 text-muted">{t("nothingToPreview")}</p>
          )}
        </div>
      )}
      <p id={`${id}-hint`} className="text-[13px] text-muted">
        {t("markdownHint")}
      </p>
      {error && (
        <p id={`${id}-error`} className="text-[13px] text-live">
          {error}
        </p>
      )}
    </div>
  );
}
