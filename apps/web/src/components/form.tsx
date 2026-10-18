import type { InputHTMLAttributes, ReactNode } from "react";

/** Labelled input with an accessible error message. Always use this instead of a bare <input>. */
export function Field({
  label,
  error,
  hint,
  id,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; error?: string; hint?: ReactNode }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-11 rounded-[var(--radius-control)] border bg-surface px-3 text-[15px] ${error ? "border-2 border-live" : "border-line-strong"}`}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-live">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  const cls = tone === "error" ? "bg-live-soft text-live-fg" : "bg-success-soft text-[#0C6447]";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[var(--radius-control)] px-3 py-2.5 text-sm ${cls}`}
    >
      {children}
    </p>
  );
}
