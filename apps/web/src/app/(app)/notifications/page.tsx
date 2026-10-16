import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { listNotifications } from "@/server/services/notifications";
import { NotificationList } from "./notification-list";

export const metadata: Metadata = { title: "Notifications" };

/** "5 min ago", "3 h ago", "Yesterday", then a date on the reader's clock. */
function when(d: Date, now: Date, timeZone: string): string {
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const actor = await requirePageActor();
  const { before } = await searchParams;
  const date = before ? new Date(before) : undefined;
  const page = await listNotifications(deps(), actor, {
    before: date && !Number.isNaN(date.getTime()) ? date : undefined,
  });
  const now = deps().now();
  const last = page.items.at(-1);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="mt-1 text-muted">Grades, join requests, new work and class reminders.</p>
      </header>
      {page.items.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-line bg-surface p-5 text-muted">
          {before ? "No older notifications." : "Nothing yet. You'll see updates about your courses here."}
        </p>
      ) : (
        <NotificationList
          unread={page.unread}
          items={page.items.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            link: n.link,
            read: n.read,
            when: when(n.createdAt, now, actor.timezone),
          }))}
        />
      )}
      <div className="flex gap-2">
        {before && (
          <Link href="/notifications" className={buttonClasses("secondary")}>
            Newest
          </Link>
        )}
        {page.more && last && (
          <Link
            href={`/notifications?before=${encodeURIComponent(last.createdAt.toISOString())}`}
            className={buttonClasses("secondary")}
          >
            Older
          </Link>
        )}
      </div>
    </div>
  );
}
