import { ROLES, listUsersQuerySchema } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { listUsers } from "@/server/services/admin-users";
import { AddUsers } from "./add-users";
import { UserRow } from "./user-row";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("AdminUsers"))("title") };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageActor(["ADMIN"]);
  const raw = await searchParams;
  const parsed = listUsersQuerySchema.safeParse({
    q: typeof raw.q === "string" && raw.q ? raw.q : undefined,
    role: typeof raw.role === "string" && raw.role ? raw.role : undefined,
    page: raw.page,
  });
  const query = parsed.success ? parsed.data : { page: 1 };
  const [result, t, locale] = await Promise.all([
    listUsers(deps(), actor, query),
    getTranslations("AdminUsers"),
    getLocale(),
  ]);
  const pageHref = (page: number) => {
    const sp = new URLSearchParams();
    if (query.q) sp.set("q", query.q);
    if (query.role) sp.set("role", query.role);
    if (page > 1) sp.set("page", String(page));
    const s = sp.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: actor.timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("intro")}</p>
      </header>

      <AddUsers />

      <section
        aria-labelledby="list-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="list-h" className="sr-only">
          {t("allUsers")}
        </h2>
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end" role="search">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="q" className="text-sm font-semibold">
              {t("search")}
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query.q ?? ""}
              placeholder={t("searchPlaceholder")}
              className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className="text-sm font-semibold">
              {t("role")}
            </label>
            <select
              id="role"
              name="role"
              defaultValue={query.role ?? ""}
              className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]"
            >
              <option value="">{t("everyone")}</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t("roleFilter", { role: r })}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 font-semibold hover:bg-canvas"
          >
            {t("search")}
          </button>
        </form>

        <p className="mt-4 text-sm text-muted" role="status">
          {result.total === 0
            ? t("noMatch")
            : result.pages > 1
              ? t("totalPaged", { count: result.total, page: result.page, pages: result.pages })
              : t("total", { count: result.total })}
        </p>
        <ul className="mt-2 flex flex-col divide-y divide-line">
          {result.users.map((u) => (
            <li key={u.id}>
              <UserRow
                user={{
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  isActive: u.isActive,
                  needsInvite: !u.hasPassword && !u.hasGoogle,
                  isSelf: u.id === actor.id,
                  children: u.children,
                  deletesOn: u.purgeOn ? fmt.format(u.purgeOn) : null,
                  meta: [
                    u.role === "TEACHER" && t("coursesTaught", { count: u.courseCount }),
                    u.role === "STUDENT" && t("courses", { count: u.courseCount }),
                    t("addedOn", { date: fmt.format(u.createdAt) }),
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }}
              />
            </li>
          ))}
        </ul>
        {result.pages > 1 && (
          <nav aria-label={t("pages")} className="mt-4 flex justify-between">
            {result.page > 1 ? (
              <Link href={pageHref(result.page - 1)} className="font-semibold text-primary-fg">
                {t("previous")}
              </Link>
            ) : (
              <span />
            )}
            {result.page < result.pages && (
              <Link href={pageHref(result.page + 1)} className="font-semibold text-primary-fg">
                {t("next")}
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
