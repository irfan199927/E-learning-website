/**
 * School admins manage accounts: list and search, change roles, deactivate, and add people (one at a time or
 * from a CSV). Added people get an email to choose their password; nobody handles passwords. Everything here
 * needs the `user:manage` permission and is audited.
 */
import {
  assertCan,
  Errors,
  isMinorOn,
  type CreateUsersInput,
  type ListUsersQuery,
  type UpdateUserInput,
} from "@elearner/core";
import { ConsentType, Role } from "@elearner/db";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";

export const USERS_PAGE_SIZE = 50;

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
  createdAt: Date;
  courseCount: number;
  /** Students only: under 18 (from their date of birth), and whether a parent's consent is on file. */
  minor: null | { consent: boolean };
}

export async function listUsers(
  deps: Deps,
  actor: Actor,
  query: ListUsersQuery,
): Promise<{ users: AdminUserRow[]; total: number; page: number; pages: number }> {
  assertCan(actor.role, "user:manage");
  const where = {
    deletedAt: null,
    ...(query.role ? { role: query.role } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    deps.db.user.count({ where }),
    deps.db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        dateOfBirth: true,
        accounts: { select: { providerId: true } },
        consents: {
          where: { type: ConsentType.PARENTAL_VERIFIABLE, withdrawnAt: null },
          select: { id: true },
          take: 1,
        },
        _count: { select: { enrollments: { where: { revokedAt: null } }, coursesTaught: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
    }),
  ]);
  return {
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
    users: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      hasPassword: u.accounts.some((a) => a.providerId === "credential"),
      hasGoogle: u.accounts.some((a) => a.providerId === "google"),
      courseCount: u.role === Role.TEACHER ? u._count.coursesTaught : u._count.enrollments,
      minor:
        u.role === Role.STUDENT && u.dateOfBirth && isMinorOn(u.dateOfBirth, deps.now())
          ? { consent: u.consents.length > 0 }
          : null,
    })),
  };
}

/** Change a role and/or deactivate. Deactivating signs the person out everywhere at once. */
export async function updateUser(
  deps: Deps,
  actor: Actor,
  userId: string,
  input: UpdateUserInput,
): Promise<{ role: Role; isActive: boolean }> {
  assertCan(actor.role, "user:manage");
  const user = await deps.db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, role: true, isActive: true },
  });
  if (!user) throw Errors.notFound("User");
  if (user.id === actor.id && (input.isActive === false || (input.role && input.role !== Role.ADMIN)))
    throw Errors.conflict("You can't remove your own admin access. Ask another admin.");

  const losesAdmin =
    user.role === Role.ADMIN &&
    user.isActive &&
    ((input.role !== undefined && input.role !== Role.ADMIN) || input.isActive === false);
  if (losesAdmin) {
    const admins = await deps.db.user.count({ where: { role: Role.ADMIN, isActive: true, deletedAt: null } });
    if (admins <= 1)
      throw Errors.conflict("This is the last active admin. Make someone else an admin first.");
  }

  const role = input.role ?? user.role;
  const isActive = input.isActive ?? user.isActive;
  await deps.db.$transaction([
    deps.db.user.update({ where: { id: user.id }, data: { role, isActive } }),
    // Database sessions: deleting them takes effect on the person's next request.
    ...(isActive ? [] : [deps.db.session.deleteMany({ where: { userId: user.id } })]),
  ]);
  if (role !== user.role)
    await audit(deps.db, actor, "user.role", { type: "User", id: user.id }, { from: user.role, to: role });
  if (isActive !== user.isActive)
    await audit(deps.db, actor, isActive ? "user.activate" : "user.deactivate", {
      type: "User",
      id: user.id,
    });
  return { role, isActive };
}

export type CreateUserResult =
  | { email: string; status: "created" }
  | { email: string; status: "exists" }
  | { email: string; status: "email-failed" };

/**
 * Add people. Existing emails are skipped (never changed). Each new person gets a "choose a password" email.
 * Admin-created accounts count as verified: the admin vouches for the address, and the emailed link proves it.
 */
export async function createUsers(
  deps: Deps,
  actor: Actor,
  input: CreateUsersInput,
): Promise<{ results: CreateUserResult[] }> {
  assertCan(actor.role, "user:manage");
  const emails = input.users.map((u) => u.email);
  const existing = new Set(
    (await deps.db.user.findMany({ where: { email: { in: emails } }, select: { email: true } })).map(
      (u) => u.email,
    ),
  );

  const results: CreateUserResult[] = [];
  for (const u of input.users) {
    if (existing.has(u.email)) {
      results.push({ email: u.email, status: "exists" });
      continue;
    }
    const user = await deps.db.user.create({
      data: { email: u.email, name: u.name, role: u.role, emailVerified: true, isActive: true },
      select: { id: true },
    });
    await audit(deps.db, actor, "user.create", { type: "User", id: user.id }, { role: u.role });
    try {
      await deps.sendPasswordSetup(u.email);
      results.push({ email: u.email, status: "created" });
    } catch {
      results.push({ email: u.email, status: "email-failed" });
    }
  }
  return { results };
}

/** Send the "choose a password" email again (links expire after an hour). */
export async function resendInvite(deps: Deps, actor: Actor, userId: string): Promise<void> {
  assertCan(actor.role, "user:manage");
  const user = await deps.db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { email: true },
  });
  if (!user) throw Errors.notFound("User");
  await deps.sendPasswordSetup(user.email);
  await audit(deps.db, actor, "user.invite", { type: "User", id: userId });
}
