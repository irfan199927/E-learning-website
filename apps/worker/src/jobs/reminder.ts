/**
 * Class reminders (24 h and 15 min before). In-app notification + email.
 * Idempotent: Notification.dedupeKey is unique, so a retried job never double-sends.
 * Stale-safe: if the class moved or was cancelled since the job was queued, it does nothing.
 */
import { templates } from "@elearner/notify";
import type { ReminderJob } from "@elearner/queue";
import type { JobContext } from "../context";

export async function sendReminder(
  ctx: JobContext,
  job: ReminderJob,
): Promise<{ sent: number; skipped?: string }> {
  const cls = await ctx.db.classSession.findUnique({
    where: { id: job.classSessionId },
    include: { course: { select: { title: true } } },
  });
  if (!cls) return { sent: 0, skipped: "class deleted" };
  if (cls.status !== "SCHEDULED") return { sent: 0, skipped: `class ${cls.status.toLowerCase()}` };
  if (cls.startsAt.getTime() !== job.startsAtMs) return { sent: 0, skipped: "class rescheduled" };

  const students = await ctx.db.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      enrollments: { some: { courseId: cls.courseId, revokedAt: null } },
    },
    select: { id: true, email: true, name: true, timezone: true },
  });
  // Parents only get the day-before reminder (less noise).
  const parents =
    cls.notifyParents && job.kind === "24h"
      ? await ctx.db.user.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            parentLinks: {
              some: { verifiedAt: { not: null }, studentId: { in: students.map((s) => s.id) } },
            },
          },
          select: { id: true, email: true, name: true, timezone: true },
        })
      : [];

  let sent = 0;
  for (const user of [...students, ...parents]) {
    const dedupeKey = `reminder_${job.kind}_${cls.id}_${user.id}`;
    const created = await ctx.db.notification.createMany({
      data: [
        {
          userId: user.id,
          channel: "IN_APP",
          type: `class.reminder.${job.kind}`,
          title: job.kind === "15m" ? `${cls.title} starts in 15 minutes` : `${cls.title} is tomorrow`,
          body: cls.course.title,
          link: "/dashboard",
          dedupeKey,
        },
      ],
      skipDuplicates: true,
    });
    if (created.count === 0) continue; // already handled by an earlier attempt

    try {
      await ctx.mailer.send(
        user.email,
        templates.classReminder({
          name: user.name,
          classTitle: cls.title,
          courseTitle: cls.course.title,
          startsAt: cls.startsAt,
          timeZone: user.timezone,
          kind: job.kind,
          url: `${ctx.config.appUrl}/dashboard`,
          location: cls.location,
        }),
      );
      await ctx.db.notification.update({ where: { dedupeKey }, data: { sentAt: ctx.now() } });
      sent++;
    } catch (err) {
      // One bad address must not block the class. In-app notice still exists.
      ctx.log.warn({ err, userId: user.id, classId: cls.id }, "reminder email failed");
    }
  }
  return { sent };
}
