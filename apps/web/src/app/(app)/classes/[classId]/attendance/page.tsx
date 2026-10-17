import { formatInZone, isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getAttendanceSheet } from "@/server/services/attendance";
import { AttendanceSheet } from "./attendance-sheet";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Attendance"))("title") };
}

export default async function AttendancePage({ params }: { params: Promise<{ classId: string }> }) {
  const actor = await requirePageActor(["TEACHER", "ADMIN"]);
  const { classId } = await params;
  const sheet = await getAttendanceSheet(deps(), actor, classId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  const [t, locale] = await Promise.all([getTranslations("Attendance"), getLocale()]);
  const startsAt = formatInZone(sheet.class.startsAt, actor.timezone, intlLocale(locale));
  const c = sheet.class;
  const notAgreed = sheet.rows.filter((r) => r.enrolled && !r.recordingConsent).length;
  const where = [c.location, c.fromGoogle ? "Google Meet" : c.online ? t("online") : null].filter(Boolean);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href={`/courses/${c.courseId}#attendance`}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        {c.courseTitle}
      </Link>
      <header>
        <p className="text-sm font-semibold text-muted">{t("title")}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{c.title}</h1>
        <p className="mt-1 text-muted">
          {startsAt}
          {where.length > 0 && ` · ${where.join(" · ")}`}
          {c.status === "CANCELLED" && ` · ${t("cancelled")}`}
        </p>
      </header>

      <section
        aria-labelledby="sheet-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="sheet-h" className="font-display text-xl font-bold">
          {t("students", { count: sheet.rows.length })}
        </h2>
        <p className="mb-3 text-sm text-muted">
          {sheet.marked > 0
            ? t("summary", { present: sheet.present, marked: sheet.marked })
            : c.fromGoogle
              ? t("meetFills")
              : t("nobodyMarked")}{" "}
          {t("parentsSee")}
          {c.online && notAgreed > 0 && <> {t("notAgreed", { count: notAgreed })}</>}
        </p>
        {c.status === "CANCELLED" ? (
          <p className="text-muted">{t("wasCancelled")}</p>
        ) : !c.started ? (
          <p className="text-muted">{t("notStarted", { time: startsAt })}</p>
        ) : (
          <AttendanceSheet classId={c.id} rows={sheet.rows} />
        )}
      </section>
    </div>
  );
}
