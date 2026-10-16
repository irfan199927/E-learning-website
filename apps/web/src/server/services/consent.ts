/**
 * Parental consent for minors (DPDP Act 2023, s.9).
 *
 * 1. Every student gives their date of birth once (the app layout sends them to /welcome until they do).
 * 2. Under-18s can browse the course catalog, but can't ask to join (and teachers can't approve them) until a
 *    parent gives consent.
 * 3. The student enters a parent's email; the parent gets a single-use link (7 days) to a page that explains what
 *    the school stores. They confirm they're the parent or guardian, and a `Consent` row records who (name and
 *    email), when, from where (IP), how ("parent-email-link") and which notice version they saw.
 *
 * Only the SHA-256 of the link token is stored. A parent needs no account; if they have one (same email), the
 * consent also links them to the child (parents.ts).
 */
import { randomBytes } from "node:crypto";
import {
  CONSENT_LINK_TTL_MS,
  CONSENT_NOTICE_VERSION,
  Errors,
  isMinorOn,
  sha256Hex,
  type DateOfBirthInput,
  type GrantConsentInput,
  type ParentConsentRequestInput,
} from "@elearner/core";
import { ConsentType, Role, type Db } from "@elearner/db";
import { templates } from "@elearner/notify";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { linkByConsentEmail } from "./parents";

export type ConsentState =
  /** Not a student, or an adult student: nothing to do. */
  | { kind: "not-needed" }
  /** A student who hasn't told us their date of birth yet. */
  | { kind: "needs-dob" }
  /** A minor without consent; `pendingEmail` is set while a parent's link is outstanding. */
  | { kind: "needs-consent"; pendingEmail: string | null }
  | { kind: "given"; parentName: string | null; grantedAt: Date };

async function activeConsent(db: Db, userId: string) {
  return db.consent.findFirst({
    where: { userId, type: ConsentType.PARENTAL_VERIFIABLE, withdrawnAt: null },
    orderBy: { grantedAt: "desc" },
    select: { parentName: true, grantedAt: true },
  });
}

export async function getConsentState(deps: Deps, userId: string): Promise<ConsentState> {
  const user = await deps.db.user.findUnique({
    where: { id: userId },
    select: { role: true, dateOfBirth: true, isMinor: true },
  });
  if (!user || user.role !== Role.STUDENT) return { kind: "not-needed" };
  if (!user.dateOfBirth) return { kind: "needs-dob" };
  // Re-check the age on every read: a student stops needing consent on their 18th birthday.
  if (!isMinorOn(user.dateOfBirth, deps.now())) return { kind: "not-needed" };
  const consent = await activeConsent(deps.db, userId);
  if (consent) return { kind: "given", parentName: consent.parentName, grantedAt: consent.grantedAt };
  const pending = await deps.db.consentRequest.findFirst({
    where: { studentId: userId, usedAt: null, expiresAt: { gt: deps.now() } },
    orderBy: { createdAt: "desc" },
    select: { parentEmail: true },
  });
  return { kind: "needs-consent", pendingEmail: pending?.parentEmail ?? null };
}

/**
 * The gate used by join requests and approvals. Throws CONFLICT with a message the UI can show as is.
 * `who` words the message for the student themselves or for the teacher approving them.
 */
export async function assertMayJoinCourses(
  deps: Deps,
  userId: string,
  who: "self" | "teacher",
): Promise<void> {
  const state = await getConsentState(deps, userId);
  if (state.kind === "needs-dob")
    throw Errors.conflict(
      who === "self"
        ? "Tell us your date of birth first."
        : "This student hasn't given their date of birth yet, so they can't join a course.",
    );
  if (state.kind === "needs-consent")
    throw Errors.conflict(
      who === "self"
        ? "A parent needs to approve your account before you can join courses."
        : "This student is under 18 and a parent hasn't given consent yet.",
    );
}

/** A student gives their date of birth (once; an admin can correct it later). */
export async function setDateOfBirth(
  deps: Deps,
  actor: Actor,
  input: DateOfBirthInput,
): Promise<ConsentState> {
  if (actor.role !== Role.STUDENT) throw Errors.forbidden("Only students are asked for a date of birth.");
  const user = await deps.db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { dateOfBirth: true },
  });
  if (user.dateOfBirth)
    throw Errors.conflict("Your date of birth is already saved. Ask your school to correct it.");
  await deps.db.user.update({
    where: { id: actor.id },
    data: { dateOfBirth: input.dateOfBirth, isMinor: isMinorOn(input.dateOfBirth, deps.now()) },
  });
  await audit(deps.db, actor, "user.dob", { type: "User", id: actor.id });
  return getConsentState(deps, actor.id);
}

/** A minor asks a parent for consent. Sending again replaces any earlier link. */
export async function requestParentConsent(
  deps: Deps,
  actor: Actor,
  input: ParentConsentRequestInput,
): Promise<{ sentTo: string }> {
  const state = await getConsentState(deps, actor.id);
  if (state.kind !== "needs-consent") throw Errors.conflict("Your account doesn't need a parent's approval.");
  if (input.parentEmail === actor.email.toLowerCase())
    throw Errors.validation("Use your parent's or guardian's email, not your own.");

  const token = randomBytes(32).toString("base64url");
  const now = deps.now();
  await deps.db.$transaction([
    deps.db.consentRequest.updateMany({
      where: { studentId: actor.id, usedAt: null },
      data: { expiresAt: now }, // older links stop working
    }),
    deps.db.consentRequest.create({
      data: {
        studentId: actor.id,
        parentEmail: input.parentEmail,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(now.getTime() + CONSENT_LINK_TTL_MS),
      },
    }),
  ]);
  await deps.mailer.send(
    input.parentEmail,
    templates.parentConsent(actor.name, `${deps.config.appUrl}/consent/${token}`),
  );
  await audit(deps.db, actor, "consent.request", { type: "User", id: actor.id });
  return { sentTo: input.parentEmail };
}

async function openRequest(deps: Deps, token: string) {
  const request = await deps.db.consentRequest.findUnique({
    where: { tokenHash: sha256Hex(token) },
    select: {
      id: true,
      studentId: true,
      parentEmail: true,
      expiresAt: true,
      usedAt: true,
      student: { select: { name: true } },
    },
  });
  if (!request) return { status: "invalid" as const };
  if (request.usedAt) return { status: "used" as const, studentName: request.student.name };
  if (request.expiresAt <= deps.now())
    return { status: "expired" as const, studentName: request.student.name };
  return { status: "open" as const, request };
}

/** What the parent's consent page shows. Public: the link token is the credential. */
export async function viewConsentRequest(
  deps: Deps,
  token: string,
): Promise<{ status: "open" | "used" | "expired" | "invalid"; studentName?: string; parentEmail?: string }> {
  const r = await openRequest(deps, token);
  if (r.status !== "open") return r;
  return { status: "open", studentName: r.request.student.name, parentEmail: r.request.parentEmail };
}

/** The parent gives consent. Single use; records the declaration with the notice version and IP. */
export async function grantConsent(
  deps: Deps,
  token: string,
  input: GrantConsentInput,
  ip: string | null,
): Promise<{ studentName: string }> {
  const r = await openRequest(deps, token);
  if (r.status === "invalid") throw Errors.notFound("Consent link");
  if (r.status === "used")
    throw Errors.conflict("Consent was already given with this link. Nothing else to do.");
  if (r.status === "expired")
    throw Errors.conflict("This link has expired. Ask your child to send a new one.");

  const { request } = r;
  const now = deps.now();
  // One transaction: claim the link (so two parallel submits can't both succeed) and record the consent.
  await deps.db.$transaction(async (tx) => {
    const claimed = await tx.consentRequest.updateMany({
      where: { id: request.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count === 0)
      throw Errors.conflict("Consent was already given with this link. Nothing else to do.");
    await tx.consent.create({
      data: {
        userId: request.studentId,
        type: ConsentType.PARENTAL_VERIFIABLE,
        version: CONSENT_NOTICE_VERSION,
        method: "parent-email-link",
        parentName: input.parentName,
        parentEmail: request.parentEmail,
        ipAddress: ip,
        grantedAt: now,
      },
    });
    await tx.notification.create({
      data: {
        userId: request.studentId,
        channel: "IN_APP",
        type: "consent.granted",
        title: "Your parent approved your account",
        body: "You can now ask to join courses.",
        link: "/courses",
      },
    });
  });
  // A parent who already has an account now sees this child (the emailed link proved the address).
  await linkByConsentEmail(deps.db, request.parentEmail, now);
  await audit(
    deps.db,
    null,
    "consent.grant",
    { type: "User", id: request.studentId },
    {
      version: CONSENT_NOTICE_VERSION,
    },
  );
  return { studentName: request.student.name };
}
