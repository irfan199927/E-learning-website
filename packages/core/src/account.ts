/**
 * Account deletion (DPDP erasure). A deletion request soft-deletes the account (`User.deletedAt`): sign-in stops at
 * once, and the worker's purge job removes the user and their data after the grace period. Until then an admin
 * can cancel the request.
 */

export const ERASURE_GRACE_DAYS = 30;

/** When a soft-deleted account is purged (the worker purges on its first run after this). */
export function erasureDate(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + ERASURE_GRACE_DAYS * 86_400_000);
}

/** Roles that can delete their own account. Teachers and admins own courses and classes: an admin handles them. */
export const SELF_DELETE_ROLES = ["STUDENT", "PARENT"] as const;
