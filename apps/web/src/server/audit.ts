import type { Db, Prisma } from "@elearner/db";
import type { Actor } from "./deps";

/** Append-only audit trail for sensitive actions (docs/security.md#audit-logging). */
export async function audit(
  db: Db,
  actor: Pick<Actor, "id"> | null,
  action: string,
  target: { type: string; id: string },
  meta?: Prisma.InputJsonValue,
): Promise<void> {
  await db.auditLog.create({
    data: { actorId: actor?.id ?? null, action, targetType: target.type, targetId: target.id, meta },
  });
}
