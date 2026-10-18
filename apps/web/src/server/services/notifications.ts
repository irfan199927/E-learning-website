/**
 * In-app notifications: the bell in the top bar and /notifications.
 *
 * Rows are written where things happen (join requests and approvals, grades, class reminders and
 * recording issues in the worker, new assignments and quizzes). Here people read them and mark them read. A user
 * only ever sees their own rows; anyone else's id is NOT_FOUND.
 *
 * Links are stored by the app itself, but are still only followed when they're same-site paths ("/…", not "//…").
 */
import { Errors } from "@elearner/core";
import { NotificationChannel } from "@elearner/db";
import { isSitePath } from "../../lib/safe-path";
import type { Actor, Deps } from "../deps";

export const NOTIFICATIONS_PAGE_SIZE = 50;

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  /** A same-site path, or null. */
  link: string | null;
  read: boolean;
  createdAt: Date;
}

/** Only same-site paths are ever turned into links. */
export function safeLink(link: string | null): string | null {
  return isSitePath(link) ? link : null;
}

const mine = (actor: Actor) => ({ userId: actor.id, channel: NotificationChannel.IN_APP });

export async function unreadCount(deps: Deps, actor: Actor): Promise<number> {
  return deps.db.notification.count({ where: { ...mine(actor), readAt: null } });
}

/** Newest first. `before` is the createdAt of the last row on the previous page. */
export async function listNotifications(
  deps: Deps,
  actor: Actor,
  opts: { before?: Date } = {},
): Promise<{ items: NotificationRow[]; unread: number; more: boolean }> {
  const [rows, unread] = await Promise.all([
    deps.db.notification.findMany({
      where: { ...mine(actor), ...(opts.before ? { createdAt: { lt: opts.before } } : {}) },
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: NOTIFICATIONS_PAGE_SIZE + 1,
    }),
    unreadCount(deps, actor),
  ]);
  return {
    unread,
    more: rows.length > NOTIFICATIONS_PAGE_SIZE,
    items: rows.slice(0, NOTIFICATIONS_PAGE_SIZE).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: safeLink(n.link),
      read: n.readAt !== null,
      createdAt: n.createdAt,
    })),
  };
}

export async function markRead(deps: Deps, actor: Actor, id: string): Promise<{ link: string | null }> {
  const n = await deps.db.notification.findFirst({ where: { id, ...mine(actor) }, select: { link: true } });
  if (!n) throw Errors.notFound("Notification");
  await deps.db.notification.updateMany({ where: { id, readAt: null }, data: { readAt: deps.now() } });
  return { link: safeLink(n.link) };
}

export async function markAllRead(deps: Deps, actor: Actor): Promise<{ marked: number }> {
  const r = await deps.db.notification.updateMany({
    where: { ...mine(actor), readAt: null },
    data: { readAt: deps.now() },
  });
  return { marked: r.count };
}

/**
 * Tell a set of users about something (one row each). `dedupeKey` (with the user id appended) makes repeats
 * harmless, e.g. when a draft is published twice.
 */
export async function notifyUsers(
  deps: Deps,
  userIds: string[],
  n: { type: string; title: string; body: string; link: string; dedupeKey?: string },
): Promise<void> {
  if (userIds.length === 0) return;
  await deps.db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      channel: NotificationChannel.IN_APP,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      dedupeKey: n.dedupeKey ? `${n.dedupeKey}_${userId}` : null,
    })),
    skipDuplicates: true,
  });
}

/** Ids of a course's current, active students. */
export async function courseStudentIds(deps: Deps, courseId: string): Promise<string[]> {
  const rows = await deps.db.enrollment.findMany({
    where: { courseId, revokedAt: null, user: { isActive: true, deletedAt: null } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
