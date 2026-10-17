"use client";

import { createClassSchema } from "@elearner/core/schemas";
import { WEEKDAYS, type Weekday } from "@elearner/core/rrule";
import { utcToZonedInput as toLocalInput, zonedInputToUtc as fromLocalInput } from "@elearner/core/time";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { intlLocale, type Locale } from "@/i18n/locales";
import { api, ApiError } from "@/lib/api-client";

export interface CourseOption {
  id: string;
  title: string;
  students: number;
}

interface Props {
  courses: CourseOption[];
  /** With Google: a Calendar invite and a Meet link. Without: a room and/or a pasted link. */
  googleConnected: boolean;
  timeZone: string;
  initialStart: Date;
  onClose(): void;
  onScheduled(): void;
}

/** Short weekday names in the interface language ("Mon" in English); 2024-01-01 was a Monday. */
function dayLabels(locale: Locale): Record<Weekday, string> {
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: "UTC" });
  return Object.fromEntries(
    WEEKDAYS.map((d, i) => [d, fmt.format(new Date(Date.UTC(2024, 0, 1 + i)))]),
  ) as Record<Weekday, string>;
}

export function ScheduleClassForm({
  courses,
  googleConnected,
  timeZone,
  initialStart,
  onClose,
  onScheduled,
}: Props) {
  const t = useTranslations("Schedule");
  const locale = useLocale() as Locale;
  const DAY_LABEL = useMemo(() => dayLabels(locale), [locale]);
  const [meeting, setMeeting] = useState<"google" | "none">(googleConnected ? "google" : "none");
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
      meeting,
      location: meeting === "none" ? String(f.get("location") || "").trim() || undefined : undefined,
      meetingUrl: meeting === "none" ? String(f.get("meetingUrl") || "").trim() || undefined : undefined,
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
      setFormError(err instanceof ApiError ? err.message : t("scheduleFailed"));
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
          {t("heading")}
        </h2>
        <button
          type="button"
          aria-label={t("close")}
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
              {t("reconnect")}
            </a>
          )}
        </FormAlert>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field id="title" name="title" label={t("title")} required error={errors.title} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="courseId" className="text-sm font-semibold">
            {t("class")}
          </label>
          <select
            id="courseId"
            name="courseId"
            className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {t("courseOption", { title: c.title, count: c.students })}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <Field
            id="start"
            name="start"
            type="datetime-local"
            label={t("starts")}
            defaultValue={toLocalInput(initialStart, timeZone)}
            error={errors.startsAt}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="duration" className="text-sm font-semibold">
              {t("length")}
            </label>
            <select
              id="duration"
              name="duration"
              defaultValue="45"
              className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2"
            >
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {t("minutes", { count: m })}
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
          {t("repeatWeekly")}
        </label>
        {repeat && (
          <fieldset className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-canvas p-3">
            <legend className="sr-only">{t("repeatOn")}</legend>
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
              label={t("until")}
              defaultValue={untilDefault}
              error={errors["recurrence.until"]}
            />
          </fieldset>
        )}

        {googleConnected && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-semibold">{t("where")}</legend>
            {(
              [
                ["google", "Google Meet", t("googleMeetHint")],
                ["none", t("noneLabel"), t("noneHint")],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-start gap-2.5 text-sm">
                <input
                  type="radio"
                  name="meeting"
                  value={value}
                  checked={meeting === value}
                  onChange={() => setMeeting(value)}
                  className="mt-0.5 size-5 accent-[var(--color-primary)]"
                />
                <span>
                  <span className="font-semibold">{label}</span>
                  <span className="block text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {meeting === "none" && (
          <>
            <Field
              id="location"
              name="location"
              label={t("location")}
              maxLength={120}
              placeholder={t("locationPlaceholder")}
              error={errors.location}
            />
            <Field
              id="meetingUrl"
              name="meetingUrl"
              type="url"
              inputMode="url"
              label={t("meetingUrl")}
              placeholder="https://"
              hint={t("meetingUrlHint")}
              error={errors.meetingUrl}
            />
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="agenda" className="text-sm font-semibold">
            {t("agenda")} <span className="font-normal text-muted">{t("optional")}</span>
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
          {meeting === "google"
            ? pending
              ? t("creatingMeet")
              : t("scheduleWithMeet")
            : pending
              ? t("scheduling")
              : t("schedule")}
        </Button>
        <p className="text-[13px] text-muted">{meeting === "google" ? t("noteGoogle") : t("noteNone")}</p>
      </form>
    </aside>
  );
}
