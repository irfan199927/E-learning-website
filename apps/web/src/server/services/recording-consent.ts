/**
 * Recording consent: students agree to the class-recording notice (`RECORDING_NOTICE` in core) before they can
 * join live classes from E-learner. They can withdraw at any time; joining is then refused until they agree again.
 *
 * - Each agreement is a `Consent` row (type RECORDING) with the notice version, so we can show which text a
 *   student agreed to. Withdrawing sets `withdrawnAt`; rows are never deleted (they're the evidence).
 * - A new notice version makes earlier agreements "outdated": the student is asked again.
 * - Teachers see who hasn't agreed on the attendance sheet. Staff never need to agree here.
 * - Grants and withdrawals are audited (`consent.grant`, `consent.withdraw`).
 */
import {
  Errors,
  RECORDING_NOTICE_VERSION,
  recordingConsentStatus,
  type AgreeRecordingInput,
  type RecordingConsentStatus,
} from "@elearner/core";
import { ConsentType, type Db } from "@elearner/db";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";

export interface RecordingConsentView {
  status: RecordingConsentStatus;
  /** When the student agreed to the current notice (status "agreed"). */
  agreedAt: Date | null;
  version: string;
}

function latest(db: Db, userIds: string[]) {
  return db.consent.findMany({
    where: { userId: { in: userIds }, type: ConsentType.RECORDING },
    select: { userId: true, version: true, grantedAt: true, withdrawnAt: true },
    orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
    distinct: ["userId"],
  });
}

/** Status per user; users with no row are "none". */
export async function recordingConsentFor(
  db: Db,
  userIds: string[],
): Promise<Map<string, RecordingConsentStatus>> {
  const rows = userIds.length ? await latest(db, userIds) : [];
  const out = new Map<string, RecordingConsentStatus>(userIds.map((id) => [id, "none"]));
  for (const r of rows) out.set(r.userId, recordingConsentStatus(r));
  return out;
}

/** Whether a student may join live classes (staff always may). */
export async function mayJoinRecordedClasses(db: Db, actor: Actor): Promise<boolean> {
  if (actor.role !== "STUDENT") return true;
  return (await recordingConsentFor(db, [actor.id])).get(actor.id) === "agreed";
}

export async function getRecordingConsent(deps: Deps, actor: Actor): Promise<RecordingConsentView> {
  if (actor.role !== "STUDENT") throw Errors.notFound("Recording consent");
  const [row] = await latest(deps.db, [actor.id]);
  const status = recordingConsentStatus(row ?? null);
  return { status, agreedAt: status === "agreed" ? row!.grantedAt : null, version: RECORDING_NOTICE_VERSION };
}

/** Agree to the notice the student was shown. A stale version is refused so nobody agrees to text they didn't see. */
export async function agreeToRecording(
  deps: Deps,
  actor: Actor,
  input: AgreeRecordingInput,
): Promise<RecordingConsentView> {
  if (actor.role !== "STUDENT") throw Errors.notFound("Recording consent");
  if (input.version !== RECORDING_NOTICE_VERSION)
    throw Errors.conflict("The recording notice has changed. Reload the page and read it again.");
  const current = await getRecordingConsent(deps, actor);
  if (current.status === "agreed") return current;
  const row = await deps.db.consent.create({
    data: {
      userId: actor.id,
      type: ConsentType.RECORDING,
      version: RECORDING_NOTICE_VERSION,
      method: "in-app-notice",
      grantedAt: deps.now(),
    },
    select: { id: true, grantedAt: true },
  });
  await audit(
    deps.db,
    actor,
    "consent.grant",
    { type: "Consent", id: row.id },
    {
      type: "RECORDING",
      version: RECORDING_NOTICE_VERSION,
    },
  );
  return { status: "agreed", agreedAt: row.grantedAt, version: RECORDING_NOTICE_VERSION };
}

/** Withdraw: every open RECORDING agreement of the student is closed. */
export async function withdrawRecordingConsent(deps: Deps, actor: Actor): Promise<RecordingConsentView> {
  if (actor.role !== "STUDENT") throw Errors.notFound("Recording consent");
  const { count } = await deps.db.consent.updateMany({
    where: { userId: actor.id, type: ConsentType.RECORDING, withdrawnAt: null },
    data: { withdrawnAt: deps.now() },
  });
  if (count > 0)
    await audit(deps.db, actor, "consent.withdraw", { type: "User", id: actor.id }, { type: "RECORDING" });
  return getRecordingConsent(deps, actor);
}
