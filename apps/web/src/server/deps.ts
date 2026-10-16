/**
 * Dependencies the services layer needs, as interfaces. Production wiring lives in
 * container.ts; tests pass fakes. Services never import env, Next.js, or singletons
 * directly — that is what keeps them unit-testable (see docs/development.md#layers).
 */
import type { Role } from "@elearner/core";
import type { Db } from "@elearner/db";
import type { GoogleOAuthConfig, CredentialStore, TeacherGoogle } from "@elearner/google";
import type { Mailer } from "@elearner/notify";
import type { Jobs } from "@elearner/queue";
import type { Storage } from "@elearner/storage";

/** The signed-in user performing an action. */
export interface Actor {
  id: string;
  role: Role;
  email: string;
  name: string;
  timezone: string;
}

export type JobsPort = Pick<
  Jobs,
  | "scheduleReminders"
  | "cancelReminders"
  | "enqueueTranscode"
  | "enqueueRecordingSync"
  | "enqueueCalendarSync"
>;

export type StoragePort = Pick<
  Storage,
  | "createMultipart"
  | "presignPart"
  | "completeMultipart"
  | "abortMultipart"
  | "presignGet"
  | "head"
  | "getText"
>;

export interface AppConfig {
  appUrl: string;
  authSecret: string;
  maxUploadBytes: number;
  joinOpensMinutesBefore: number;
  google: GoogleOAuthConfig;
}

export interface Deps {
  db: Db;
  storage: StoragePort;
  jobs: JobsPort;
  mailer: Mailer;
  credentials: CredentialStore;
  /**
   * Email a link to choose a password (Better Auth's reset flow; it also creates the password login if the
   * user has none, so it doubles as an invite for admin-created accounts).
   */
  sendPasswordSetup(email: string): Promise<void>;
  /** Google client acting as the given teacher (throws GOOGLE_RECONNECT_REQUIRED if no grant). */
  googleFor(userId: string): Promise<TeacherGoogle>;
  now(): Date;
  config: AppConfig;
}
