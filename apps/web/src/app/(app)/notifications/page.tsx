import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { listNotifications } from "@/server/services/notifications";
import { NotificationList } from "./notification-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Notifications"))("title") };
}

type T = Awaited<ReturnType<typeof getTranslations<"Notifications">>>;

/** "5 min ago", "3 h ago", "Yesterday", then a date on the reader's clock. */
function when(d: Date, now: Date, timeZone: string, t: T, locale: string): string {
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return t("minAgo", { count: mins });
  if (mins < 24 * 60) return t("hoursAgo", { count: Math.round(mins / 60) });
  return new Intl.DateTimeFormat(locale, {
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
  const [t, locale] = await Promise.all([getTranslations("Notifications"), getLocale()]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("intro")}</p>
      </header>
      {page.items.length === 0 ? (
        <EmptyState icon="bell">{before ? t("noOlder") : t("empty")}</EmptyState>
      ) : (
        <NotificationList
          unread={page.unread}
          items={page.items.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            link: n.link,
            read: n.read,
            when: when(n.createdAt, now, actor.timezone, t, intlLocale(locale)),
          }))}
        />
      )}
      <div className="flex gap-2">
        {before && (
          <Link href="/notifications" className={buttonClasses("secondary")}>
            {t("newest")}
          </Link>
        )}
        {page.more && last && (
          <Link
            href={`/notifications?before=${encodeURIComponent(last.createdAt.toISOString())}`}
            className={buttonClasses("secondary")}
          >
            {t("older")}
          </Link>
        )}
      </div>
    </div>
  );
}
