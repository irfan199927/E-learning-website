/**
 * Two-way Calendar sync: when a teacher moves or deletes a class directly in Google
 * Calendar, mirror it here (times, cancellation, reminders). Triggered by push notifications.
 */
import type { CalendarSyncJob } from "@elearner/queue";
import type { JobContext } from "../context";

export async function syncCalendar(ctx: JobContext, job: CalendarSyncJob) {
  const channel = await ctx.db.watchChannel.findFirst({
    where: { userId: job.userId, kind: "calendar" },
    orderBy: { createdAt: "desc" },
  });
  if (!channel) return { updated: 0, cancelled: 0, skipped: "no channel" };

  const google = await ctx.googleFor(job.userId);
  const { events, nextSyncToken } = await google.listChangedEvents(channel.syncToken);

  const byId = new Map(events.map((e) => [e.eventId, e]));
  const sessions = byId.size
    ? await ctx.db.classSession.findMany({
        where: { hostId: job.userId, googleEventId: { in: [...byId.keys()] } },
      })
    : [];

  let updated = 0;
  let cancelled = 0;
  for (const s of sessions) {
    const ev = byId.get(s.googleEventId!)!;
    if (s.status === "CANCELLED" || s.status === "ENDED") continue;
    if (ev.status === "cancelled") {
      await ctx.db.classSession.update({ where: { id: s.id }, data: { status: "CANCELLED" } });
      await ctx.jobs.cancelReminders(s.id, s.startsAt);
      cancelled++;
    } else if (
      ev.startsAt &&
      ev.endsAt &&
      (ev.startsAt.getTime() !== s.startsAt.getTime() || ev.endsAt.getTime() !== s.endsAt.getTime())
    ) {
      await ctx.db.classSession.update({
        where: { id: s.id },
        data: { startsAt: ev.startsAt, endsAt: ev.endsAt },
      });
      await ctx.jobs.cancelReminders(s.id, s.startsAt);
      await ctx.jobs.scheduleReminders(s.id, ev.startsAt, ctx.now());
      updated++;
    }
  }
  if (nextSyncToken)
    await ctx.db.watchChannel.updateMany({
      where: { userId: job.userId, kind: "calendar" },
      data: { syncToken: nextSyncToken },
    });
  return { updated, cancelled };
}
