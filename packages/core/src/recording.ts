/**
 * The class-recording notice students agree to before joining live classes (DPDP: informed, specific consent).
 * Changing the text means bumping RECORDING_NOTICE_VERSION: everyone is then asked to agree again. Bump the copy in
 * packages/db/prisma/seed.ts too, or the seeded student (Aanya) is asked again.
 * Not legal advice: have counsel review this text before launch.
 */

export const RECORDING_NOTICE_VERSION = "2026-10-17";

export const RECORDING_NOTICE = {
  title: "Live classes are recorded",
  points: [
    "Your teacher may record live classes on Google Meet. A recording can include your name, your voice, and your video when your camera is on.",
    "Recordings go into the course's video library. Only the course teacher, school admins and students enrolled in the course can watch them.",
    "You can keep your camera and microphone off during a class.",
    "Recordings stay in the course library until the school removes them.",
    "You can withdraw your agreement at any time on this page. After that you can't join live classes from E-learner. Recordings already made are not deleted automatically: ask your teacher or the school if you want one removed.",
  ],
} as const;

export type RecordingConsentStatus =
  /** Agreed to the current notice. */
  | "agreed"
  /** Agreed to an older version of the notice: must agree again. */
  | "outdated"
  /** Agreed, then withdrew. */
  | "withdrawn"
  /** Never answered. */
  | "none";

/** Status from the newest RECORDING consent row (null: none). */
export function recordingConsentStatus(
  latest: { version: string; withdrawnAt: Date | null } | null,
  currentVersion = RECORDING_NOTICE_VERSION,
): RecordingConsentStatus {
  if (!latest) return "none";
  if (latest.withdrawnAt) return "withdrawn";
  return latest.version === currentVersion ? "agreed" : "outdated";
}
