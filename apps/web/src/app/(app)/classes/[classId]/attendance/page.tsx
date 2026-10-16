import { formatInZone, isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getAttendanceSheet } from "@/server/services/attendance";
import { AttendanceSheet } from "./attendance-sheet";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({ params }: { params: Promise<{ classId: string }> }) {
  const actor = await requirePageActor(["TEACHER", "ADMIN"]);
  const { classId } = await params;
  const sheet = await getAttendanceSheet(deps(), actor, classId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  const c = sheet.class;
  const where = [c.location, c.fromGoogle ? "Google Meet" : c.online ? "Online link" : null].filter(Boolean);

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
        <p className="text-sm font-semibold text-muted">Attendance</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{c.title}</h1>
        <p className="mt-1 text-muted">
          {formatInZone(c.startsAt, actor.timezone)}
          {where.length > 0 && ` · ${where.join(" · ")}`}
          {c.status === "CANCELLED" && " · Cancelled"}
        </p>
      </header>

      <section
        aria-labelledby="sheet-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="sheet-h" className="font-display text-xl font-bold">
          Students ({sheet.rows.length})
        </h2>
        <p className="mb-3 text-sm text-muted">
          {sheet.marked > 0
            ? `${sheet.present} present of ${sheet.marked} marked.`
            : c.fromGoogle
              ? "Google Meet fills this in after the class. You can change any mark."
              : "Nobody is marked yet."}{" "}
          Parents see these marks.
        </p>
        {c.status === "CANCELLED" ? (
          <p className="text-muted">This class was cancelled, so there's no attendance to take.</p>
        ) : !c.started ? (
          <p className="text-muted">
            You can take attendance once the class starts, at {formatInZone(c.startsAt, actor.timezone)}.
          </p>
        ) : (
          <AttendanceSheet classId={c.id} rows={sheet.rows} />
        )}
      </section>
    </div>
  );
}
