/**
 * The signed-in person's own account: what we hold about them, and deleting it (DPDP erasure on request).
 *
 * - Students and parents can ask to delete their own account. Teachers and admins own courses and classes, so an
 *   admin handles theirs.
 * - A request soft-deletes the account (`deletedAt`) and signs the person out everywhere at once; the session
 *   hook in lib/auth.ts keeps them out. The worker purges the user and their data after ERASURE_GRACE_DAYS.
 * - Until the purge, an admin can cancel it from the Users page (`cancelAccountDeletion`).
 * - Anyone can switch the daily email of unread notifications off or on (`setEmailDigest`).
 * - Requests and cancellations are audited (`user.delete_request`, `user.restore`); the person gets an email.
 */
import {
  assertCan,
  erasureDate,
  Errors,
  formatInZone,
  SELF_DELETE_ROLES,
  type DeleteAccountInput,
  type EmailDigestInput,
  type Role,
} from "@elearner/core";
import { templates } from "@elearner/notify";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";

export interface AccountView {
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
  signIn: { google: boolean; password: boolean };
  /** Whether they can delete the account themselves. */
  canDelete: boolean;
  /** Daily email of unread notifications. */
  emailDigest: boolean;
}

const canSelfDelete = (role: Role) => (SELF_DELETE_ROLES as readonly Role[]).includes(role);

export async function getAccount(deps: Deps, actor: Actor): Promise<AccountView> {
  const user = await deps.db.user.findUnique({
    where: { id: actor.id },
    select: {
      name: true,
      email: true,
      role: true,
      createdAt: true,
      emailDigest: true,
      accounts: { select: { providerId: true } },
    },
  });
  if (!user) throw Errors.notFound("Account");
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    signIn: {
      google: user.accounts.some((a) => a.providerId === "google"),
      password: user.accounts.some((a) => a.providerId === "credential"),
    },
    canDelete: canSelfDelete(user.role),
    emailDigest: user.emailDigest,
  };
}

/** Switch the daily email of unread notifications on or off (worker `send-notification-digest`). */
export async function setEmailDigest(
  deps: Deps,
  actor: Actor,
  input: EmailDigestInput,
): Promise<{ emailDigest: boolean }> {
  await deps.db.user.update({ where: { id: actor.id }, data: { emailDigest: input.enabled } });
  return { emailDigest: input.enabled };
}

/** Delete my account: sign-in stops now, the data goes after the grace period. Returns the purge date. */
export async function requestAccountDeletion(
  deps: Deps,
  actor: Actor,
  _input: DeleteAccountInput, // validated by the schema: they typed DELETE
): Promise<{ purgeOn: Date }> {
  if (!canSelfDelete(actor.role))
    throw Errors.forbidden("Teachers and admins can't delete their own account here. Ask a school admin.");
  const now = deps.now();
  await deps.db.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: actor.id, deletedAt: null },
      data: { deletedAt: now },
    });
    if (count === 0) throw Errors.conflict("This account is already being deleted.");
    await tx.session.deleteMany({ where: { userId: actor.id } });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "user.delete_request", targetType: "User", targetId: actor.id },
    });
  });
  const purgeOn = erasureDate(now);
  // The request stands even if the email fails; the account is already signed out and scheduled.
  await deps.mailer
    .send(actor.email, templates.accountDeletion(actor.name, formatInZone(purgeOn, actor.timezone)))
    .catch(() => undefined);
  return { purgeOn };
}

/** Admin: undo a deletion request before the purge. The person can sign in again. */
export async function cancelAccountDeletion(deps: Deps, actor: Actor, userId: string): Promise<void> {
  assertCan(actor.role, "user:manage");
  const { count } = await deps.db.user.updateMany({
    where: { id: userId, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (count === 0) throw Errors.notFound("Deletion request");
  await audit(deps.db, actor, "user.restore", { type: "User", id: userId });
}
