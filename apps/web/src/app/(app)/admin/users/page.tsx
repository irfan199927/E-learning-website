import { ROLES, listUsersQuerySchema } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { plural } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { listUsers } from "@/server/services/admin-users";
import { AddUsers } from "./add-users";
import { UserRow } from "./user-row";

export const metadata: Metadata = { title: "Users" };

const ROLE_LABEL: Record<(typeof ROLES)[number], string> = {
  ADMIN: "Admins",
  TEACHER: "Teachers",
  STUDENT: "Students",
  PARENT: "Parents",
};

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
  const result = await listUsers(deps(), actor, query);
  const pageHref = (page: number) => {
    const sp = new URLSearchParams();
    if (query.q) sp.set("q", query.q);
    if (query.role) sp.set("role", query.role);
    if (page > 1) sp.set("page", String(page));
    const s = sp.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };
  const fmt = new Intl.DateTimeFormat("en-IN", {
    timeZone: actor.timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-muted">
          Add people, change what they can do, or switch an account off. New people get an email to choose
          their password.
        </p>
      </header>

      <AddUsers />

      <section
        aria-labelledby="list-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="list-h" className="sr-only">
          All users
        </h2>
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end" role="search">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="q" className="text-sm font-semibold">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query.q ?? ""}
              placeholder="Name or email"
              className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className="text-sm font-semibold">
              Role
            </label>
            <select
              id="role"
              name="role"
              defaultValue={query.role ?? ""}
              className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]"
            >
              <option value="">Everyone</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 font-semibold hover:bg-canvas"
          >
            Search
          </button>
        </form>

        <p className="mt-4 text-sm text-muted" role="status">
          {result.total === 0
            ? "No one matches."
            : `${result.total} ${result.total === 1 ? "person" : "people"}`}
          {result.pages > 1 && ` · page ${result.page} of ${result.pages}`}
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
                  minor: u.minor,
                  meta: [
                    u.role === "TEACHER" && `${plural(u.courseCount, "course")} taught`,
                    u.role === "STUDENT" && plural(u.courseCount, "course"),
                    `added ${fmt.format(u.createdAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }}
              />
            </li>
          ))}
        </ul>
        {result.pages > 1 && (
          <nav aria-label="Pages" className="mt-4 flex justify-between">
            {result.page > 1 ? (
              <Link href={pageHref(result.page - 1)} className="font-semibold text-primary-fg">
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {result.page < result.pages && (
              <Link href={pageHref(result.page + 1)} className="font-semibold text-primary-fg">
                Next →
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
