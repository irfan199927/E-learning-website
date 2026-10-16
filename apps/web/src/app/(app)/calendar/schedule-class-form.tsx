"use client";

import { createClassSchema } from "@elearner/core/schemas";
import { WEEKDAYS, type Weekday } from "@elearner/core/rrule";
import { utcToZonedInput as toLocalInput, zonedInputToUtc as fromLocalInput } from "@elearner/core/time";
import { useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export interface CourseOption {
  id: string;
  title: string;
  students: number;
}

interface Props {
  courses: CourseOption[];
  timeZone: string;
  initialStart: Date;
  onClose(): void;
  onScheduled(): void;
}

const DAY_LABEL: Record<Weekday, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

export function ScheduleClassForm({ courses, timeZone, initialStart, onClose, onScheduled }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [needsGoogle, setNeedsGoogle] = useState(false);
  const [pending, setPending] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState<Weekday[]>([]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const startsAt = fromLocalInput(String(f.get("start")), timeZone);
    const minutes = Number(f.get("duration"));
    const input = {
      courseId: String(f.get("courseId")),
      title: String(f.get("title")),
      agenda: String(f.get("agenda") || "") || undefined,
      startsAt,
      endsAt: new Date(startsAt.getTime() + minutes * 60_000),
      timezone: timeZone,
      recurrence: repeat
        ? { freq: "WEEKLY" as const, byDay: days, until: fromLocalInput(`${f.get("until")}T23:59`, timeZone) }
        : undefined,
    };

    // Same schema as the server → instant, consistent feedback.
    const check = createClassSchema.safeParse(input);
    if (!check.success) {
      setErrors(Object.fromEntries(check.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    try {
      await api("/api/v1/classes", { method: "POST", json: input });
      onScheduled();
    } catch (err) {
      if (err instanceof ApiError && err.code === "GOOGLE_RECONNECT_REQUIRED") setNeedsGoogle(true);
      if (err instanceof ApiError && err.fieldErrors.length)
        setErrors(Object.fromEntries(err.fieldErrors.map((x) => [x.path, x.message])));
      setFormError(err instanceof ApiError ? err.message : "Couldn't schedule the class. Try again.");
    } finally {
      setPending(false);
    }
  }

  const untilDefault = toLocalInput(new Date(initialStart.getTime() + 60 * 86_400_000), timeZone).slice(
    0,
    10,
  );

  return (
    <aside
      aria-labelledby="schedule-h"
      className="flex w-full max-w-[400px] flex-[1_1_340px] flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6"
    >
      <div className="flex items-center justify-between">
        <h2 id="schedule-h" className="font-display text-[22px] font-bold">
          Schedule a class
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-canvas"
        >
          ×
        </button>
      </div>
      {formError && (
        <FormAlert>
          {formError}{" "}
          {needsGoogle && (
            <a className="font-semibold underline" href="/api/v1/google/connect?returnTo=/calendar">
              Reconnect Google
            </a>
          )}
        </FormAlert>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field id="title" name="title" label="Title" required error={errors.title} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="courseId" className="text-sm font-semibold">
            Class
          </label>
          <select
            id="courseId"
            name="courseId"
            className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.students} students)
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <Field
            id="start"
            name="start"
            type="datetime-local"
            label="Starts"
            defaultValue={toLocalInput(initialStart, timeZone)}
            error={errors.startsAt}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="duration" className="text-sm font-semibold">
              Length
            </label>
            <select
              id="duration"
              name="duration"
              defaultValue="45"
              className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2"
            >
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </div>
        </div>
        {errors.endsAt && <p className="text-[13px] text-live">{errors.endsAt}</p>}

        <label className="flex min-h-11 items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={repeat}
            onChange={(e) => setRepeat(e.target.checked)}
            className="size-5 accent-[var(--color-primary)]"
          />
          Repeat weekly
        </label>
        {repeat && (
          <fieldset className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-canvas p-3">
            <legend className="sr-only">Repeat on</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <label
                  key={d}
                  className={`grid h-11 min-w-11 cursor-pointer place-items-center rounded-[var(--radius-control)] border px-2 text-sm font-semibold ${days.includes(d) ? "border-primary bg-primary-soft text-primary-fg-strong" : "border-line-strong bg-surface"}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={days.includes(d)}
                    onChange={() => setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))}
                  />
                  {DAY_LABEL[d]}
                </label>
              ))}
            </div>
            {errors["recurrence.byDay"] && (
              <p className="text-[13px] text-live">{errors["recurrence.byDay"]}</p>
            )}
            <Field
              id="until"
              name="until"
              type="date"
              label="Until"
              defaultValue={untilDefault}
              error={errors["recurrence.until"]}
            />
          </fieldset>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="agenda" className="text-sm font-semibold">
            Agenda <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="agenda"
            name="agenda"
            rows={3}
            maxLength={2000}
            className="rounded-[var(--radius-control)] border border-line-strong bg-surface p-3"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating Meet link…" : "Schedule + create Meet link"}
        </Button>
        <p className="text-[13px] text-muted">
          Enrolled students get a Google Calendar invite and reminders 24 h and 15 min before.
        </p>
      </form>
    </aside>
  );
}
