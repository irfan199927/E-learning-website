/**
 * Manual UPI payments for paid courses — no payment gateway.
 *
 * - An admin publishes the school's UPI ID and/or phone number (and optionally a QR code image) on
 *   /admin/payments, and sets a course's price. A price makes the course paid: students can't "ask to join" it.
 * - A student pays from their own UPI app and reports the transaction reference (UTR), optionally with a
 *   screenshot. A reference can be used only once. Admins are notified.
 * - An admin checks the bank statement and approves (which enrols the student) or rejects with a reason (the
 *   student can report a corrected payment). Everything is audited: payment.settings, payment.submit,
 *   payment.approve, payment.reject, course.price.
 * - Admins can download payments reported in a date range as CSV for the school's accounts (payment.export).
 * - Images go straight to storage (presigned PUT). The server rebuilds each key from ids it controls and checks
 *   the real size, so nobody can point a payment at someone else's file.
 */
import { randomUUID } from "node:crypto";
import {
  assertCan,
  Errors,
  formatRupees,
  PAYMENT_IMAGE_TYPES,
  PROOF_MAX_BYTES,
  QR_MAX_BYTES,
  type CompleteQrInput,
  type CoursePriceInput,
  type DecidePaymentInput,
  type InitPaymentImageInput,
  type ListPaymentsQuery,
  type PaymentSettingsInput,
  type PaymentsExportQuery,
  type SubmitPaymentInput,
  toCsv,
  utcToZonedInput,
  zonedInputToUtc,
} from "@elearner/core";
import { ManualPaymentStatus, Prisma, Role } from "@elearner/db";
import { keys } from "@elearner/storage";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { notifyUsers } from "./notifications";

const MB = 1024 ** 2;

// ── Settings (what students pay to) ──

export interface PaymentSettingsView {
  upiId: string | null;
  payeeName: string | null;
  phone: string | null;
  instructions: string | null;
  /** Cache-busting version of the uploaded QR image, or null. */
  qrVersion: string | null;
  /** Whether students can pay at all (a UPI ID or a phone number is set). */
  ready: boolean;
}

const versionOf = (key: string | null) => (key ? (key.split("/").pop()?.split(".")[0] ?? null) : null);

export async function getPaymentSettings(deps: Deps): Promise<PaymentSettingsView> {
  const s = await deps.db.paymentSettings.findUnique({ where: { id: 1 } });
  return {
    upiId: s?.upiId ?? null,
    payeeName: s?.payeeName ?? null,
    phone: s?.phone ?? null,
    instructions: s?.instructions ?? null,
    qrVersion: versionOf(s?.qrKey ?? null),
    ready: Boolean(s?.upiId || s?.phone),
  };
}

export async function updatePaymentSettings(
  deps: Deps,
  actor: Actor,
  input: PaymentSettingsInput,
): Promise<PaymentSettingsView> {
  assertCan(actor.role, "user:manage");
  const data = {
    upiId: input.upiId ?? null,
    payeeName: input.payeeName ?? null,
    phone: input.phone ?? null,
    instructions: input.instructions ?? null,
    updatedById: actor.id,
  };
  await deps.db.paymentSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  await audit(
    deps.db,
    actor,
    "payment.settings",
    { type: "PaymentSettings", id: "1" },
    {
      upiId: data.upiId,
      phone: data.phone,
    },
  );
  return getPaymentSettings(deps);
}

export async function initQrUpload(
  deps: Deps,
  actor: Actor,
  input: InitPaymentImageInput,
): Promise<{ qrId: string; uploadUrl: string }> {
  assertCan(actor.role, "user:manage");
  if (input.sizeBytes > QR_MAX_BYTES)
    throw Errors.validation(`The QR image can be at most ${QR_MAX_BYTES / MB} MB.`);
  const qrId = randomUUID();
  const key = keys.paymentQr(qrId, PAYMENT_IMAGE_TYPES[input.mimeType]);
  return { qrId, uploadUrl: await deps.storage.presignPut(key, input.mimeType, 900) };
}

export async function completeQrUpload(deps: Deps, actor: Actor, input: CompleteQrInput): Promise<void> {
  assertCan(actor.role, "user:manage");
  const key = keys.paymentQr(input.qrId, PAYMENT_IMAGE_TYPES[input.mimeType]);
  await checkUploaded(deps, key, QR_MAX_BYTES, "The QR image");
  const before = await deps.db.paymentSettings.findUnique({ where: { id: 1 }, select: { qrKey: true } });
  await deps.db.paymentSettings.upsert({
    where: { id: 1 },
    create: { id: 1, qrKey: key, updatedById: actor.id },
    update: { qrKey: key, updatedById: actor.id },
  });
  if (before?.qrKey && before.qrKey !== key)
    await deps.storage.deleteObject(before.qrKey).catch(() => undefined);
  await audit(deps.db, actor, "payment.settings", { type: "PaymentSettings", id: "1" }, { qr: "set" });
}

export async function removeQr(deps: Deps, actor: Actor): Promise<void> {
  assertCan(actor.role, "user:manage");
  const s = await deps.db.paymentSettings.findUnique({ where: { id: 1 }, select: { qrKey: true } });
  if (!s?.qrKey) return;
  await deps.db.paymentSettings.update({ where: { id: 1 }, data: { qrKey: null, updatedById: actor.id } });
  await deps.storage.deleteObject(s.qrKey).catch(() => undefined);
  await audit(deps.db, actor, "payment.settings", { type: "PaymentSettings", id: "1" }, { qr: "remove" });
}

/** Signed URL of the QR image (anyone signed in: students need it to pay). */
export async function qrUrl(deps: Deps): Promise<string> {
  const s = await deps.db.paymentSettings.findUnique({ where: { id: 1 }, select: { qrKey: true } });
  if (!s?.qrKey) throw Errors.notFound("QR code");
  return deps.storage.presignGet(s.qrKey, 3600);
}

async function checkUploaded(deps: Deps, key: string, max: number, what: string) {
  const head = await deps.storage.head(key);
  if (!head) throw Errors.validation("The upload didn't finish. Try again.");
  if (head.size > max) {
    await deps.storage.deleteObject(key).catch(() => undefined);
    throw Errors.validation(`${what} can be at most ${max / MB} MB.`);
  }
}

// ── Course prices ──

/** Admin: set a course's price (whole rupees). 0 makes it free; students can then ask to join again. */
export async function setCoursePrice(
  deps: Deps,
  actor: Actor,
  courseId: string,
  input: CoursePriceInput,
): Promise<{ priceInPaise: number | null }> {
  assertCan(actor.role, "user:manage");
  const priceInPaise = input.priceRupees > 0 ? input.priceRupees * 100 : null;
  const { count } = await deps.db.course.updateMany({
    where: { id: courseId },
    data: { priceInPaise, isPaid: priceInPaise !== null },
  });
  if (count === 0) throw Errors.notFound("Course");
  await audit(deps.db, actor, "course.price", { type: "Course", id: courseId }, { priceInPaise });
  return { priceInPaise };
}

// ── Students: pay for a course ──

export interface PaymentView {
  id: string;
  status: ManualPaymentStatus;
  reference: string;
  amountInPaise: number;
  createdAt: Date;
  decisionNote: string | null;
}

export interface CoursePaymentPage {
  course: { id: string; title: string; priceInPaise: number };
  settings: PaymentSettingsView;
  enrolled: boolean;
  /** The student's latest report for this course, if any. */
  latest: PaymentView | null;
}

/** A published paid course, as the student about to pay sees it. */
async function paidCourse(deps: Deps, courseId: string) {
  const course = await deps.db.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, priceInPaise: true, isPaid: true, publishedAt: true },
  });
  if (!course || !course.publishedAt || !course.isPaid || !course.priceInPaise)
    throw Errors.notFound("Course");
  return { id: course.id, title: course.title, priceInPaise: course.priceInPaise };
}

export async function getCoursePayment(
  deps: Deps,
  actor: Actor,
  courseId: string,
): Promise<CoursePaymentPage> {
  if (actor.role !== Role.STUDENT) throw Errors.notFound("Course");
  const course = await paidCourse(deps, courseId);
  const [settings, enrolled, latest] = await Promise.all([
    getPaymentSettings(deps),
    deps.db.enrollment.count({ where: { courseId, userId: actor.id, revokedAt: null } }),
    deps.db.manualPayment.findFirst({
      where: { courseId, userId: actor.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        reference: true,
        amountInPaise: true,
        createdAt: true,
        decisionNote: true,
      },
    }),
  ]);
  return { course, settings, enrolled: enrolled > 0, latest };
}

export async function initProofUpload(
  deps: Deps,
  actor: Actor,
  input: InitPaymentImageInput,
): Promise<{ proofId: string; uploadUrl: string }> {
  if (actor.role !== Role.STUDENT) throw Errors.forbidden();
  if (input.sizeBytes > PROOF_MAX_BYTES)
    throw Errors.validation(`Screenshots can be at most ${PROOF_MAX_BYTES / MB} MB.`);
  const proofId = randomUUID();
  const key = keys.paymentProof(actor.id, proofId, PAYMENT_IMAGE_TYPES[input.mimeType]);
  return { proofId, uploadUrl: await deps.storage.presignPut(key, input.mimeType, 900) };
}

export async function submitPayment(
  deps: Deps,
  actor: Actor,
  courseId: string,
  input: SubmitPaymentInput,
): Promise<PaymentView> {
  if (actor.role !== Role.STUDENT) throw Errors.forbidden("Only students pay for courses.");
  const course = await paidCourse(deps, courseId);
  if (!(await getPaymentSettings(deps)).ready)
    throw Errors.conflict("Payments aren't set up yet. Ask your school.");
  if (await deps.db.enrollment.count({ where: { courseId, userId: actor.id, revokedAt: null } }))
    throw Errors.conflict("You're already in this course.");
  if (
    await deps.db.manualPayment.count({
      where: { courseId, userId: actor.id, status: ManualPaymentStatus.PENDING },
    })
  )
    throw Errors.conflict("Your payment is already waiting to be checked.");

  let proofKey: string | null = null;
  if (input.proof) {
    proofKey = keys.paymentProof(actor.id, input.proof.proofId, PAYMENT_IMAGE_TYPES[input.proof.mimeType]);
    await checkUploaded(deps, proofKey, PROOF_MAX_BYTES, "Screenshots");
  }
  let payment;
  try {
    payment = await deps.db.manualPayment.create({
      data: {
        userId: actor.id,
        courseId,
        payerName: actor.name,
        payerEmail: actor.email,
        courseTitle: course.title,
        amountInPaise: course.priceInPaise,
        reference: input.reference,
        note: input.note ?? null,
        proofKey,
      },
      select: {
        id: true,
        status: true,
        reference: true,
        amountInPaise: true,
        createdAt: true,
        decisionNote: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      throw Errors.conflict(
        "This UPI reference has already been used. Check the number in your payment app.",
      );
    throw err;
  }
  await audit(
    deps.db,
    actor,
    "payment.submit",
    { type: "ManualPayment", id: payment.id },
    {
      courseId,
      amountInPaise: payment.amountInPaise,
    },
  );
  const admins = await deps.db.user.findMany({
    where: { role: Role.ADMIN, isActive: true, deletedAt: null },
    select: { id: true },
  });
  await notifyUsers(
    deps,
    admins.map((a) => a.id),
    {
      type: "payment.submitted",
      title: `${actor.name} paid ${formatRupees(payment.amountInPaise)} for ${course.title}`,
      body: `UPI reference ${payment.reference}. Check it and approve.`,
      link: "/admin/payments",
      dedupeKey: `payment_submitted_${payment.id}`,
    },
  );
  return payment;
}

// ── Admins: check and decide ──

export interface AdminPaymentRow extends PaymentView {
  /** `id` is null once the student's account was deleted (the record is kept for the accounts). */
  student: { id: string | null; name: string; email: string };
  course: { id: string | null; title: string };
  note: string | null;
  hasProof: boolean;
  decidedAt: Date | null;
  decidedBy: string | null;
}

export async function listPayments(
  deps: Deps,
  actor: Actor,
  query: ListPaymentsQuery,
): Promise<AdminPaymentRow[]> {
  assertCan(actor.role, "user:manage");
  const rows = await deps.db.manualPayment.findMany({
    where: { status: query.status },
    orderBy: { createdAt: query.status === "PENDING" ? "asc" : "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      reference: true,
      amountInPaise: true,
      createdAt: true,
      decisionNote: true,
      note: true,
      proofKey: true,
      decidedAt: true,
      decidedBy: { select: { name: true } },
      userId: true,
      payerName: true,
      payerEmail: true,
      courseId: true,
      courseTitle: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    reference: r.reference,
    amountInPaise: r.amountInPaise,
    createdAt: r.createdAt,
    decisionNote: r.decisionNote,
    note: r.note,
    hasProof: r.proofKey !== null,
    decidedAt: r.decidedAt,
    decidedBy: r.decidedBy?.name ?? null,
    student: { id: r.userId, name: r.payerName, email: r.payerEmail },
    course: { id: r.courseId, title: r.courseTitle },
  }));
}

/** Admin: how many reported payments are waiting to be checked (the badge on the "To check" tab). */
export async function countPendingPayments(deps: Deps, actor: Actor): Promise<number> {
  assertCan(actor.role, "user:manage");
  return deps.db.manualPayment.count({ where: { status: ManualPaymentStatus.PENDING } });
}

/** Admin: signed URL of a payment screenshot. */
export async function proofUrl(deps: Deps, actor: Actor, paymentId: string): Promise<string> {
  assertCan(actor.role, "user:manage");
  const p = await deps.db.manualPayment.findUnique({ where: { id: paymentId }, select: { proofKey: true } });
  if (!p?.proofKey) throw Errors.notFound("Screenshot");
  return deps.storage.presignGet(p.proofKey, 600);
}

/** Approve (enrol the student) or reject (with a reason). Only pending payments can be decided, once. */
export async function decidePayment(
  deps: Deps,
  actor: Actor,
  paymentId: string,
  input: DecidePaymentInput,
): Promise<{ status: ManualPaymentStatus }> {
  assertCan(actor.role, "user:manage");
  const payment = await deps.db.manualPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      userId: true,
      courseId: true,
      amountInPaise: true,
      courseTitle: true,
    },
  });
  if (!payment) throw Errors.notFound("Payment");
  const { userId, courseId } = payment;
  if (!userId || !courseId)
    throw Errors.conflict(
      "The student's account or the course was deleted, so this payment can't be decided.",
    );
  const status = input.decision === "approve" ? ManualPaymentStatus.APPROVED : ManualPaymentStatus.REJECTED;
  const now = deps.now();
  await deps.db.$transaction(async (tx) => {
    const { count } = await tx.manualPayment.updateMany({
      where: { id: payment.id, status: ManualPaymentStatus.PENDING },
      data: { status, decidedAt: now, decidedById: actor.id, decisionNote: input.note ?? null },
    });
    if (count === 0) throw Errors.conflict("This payment was already decided.");
    if (status === ManualPaymentStatus.APPROVED)
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId, enrolledAt: now },
        update: { revokedAt: null, enrolledAt: now },
      });
  });
  await audit(
    deps.db,
    actor,
    status === ManualPaymentStatus.APPROVED ? "payment.approve" : "payment.reject",
    { type: "ManualPayment", id: payment.id },
    { courseId, amountInPaise: payment.amountInPaise },
  );
  await notifyUsers(
    deps,
    [userId],
    status === ManualPaymentStatus.APPROVED
      ? {
          type: "payment.approved",
          title: `Payment confirmed: you're in ${payment.courseTitle}`,
          body: "Your lessons and classes are open now.",
          link: `/courses/${courseId}`,
          dedupeKey: `payment_decided_${payment.id}`,
        }
      : {
          type: "payment.rejected",
          title: `We couldn't confirm your payment for ${payment.courseTitle}`,
          body: input.note ?? "",
          link: `/courses/${courseId}/pay`,
          dedupeKey: `payment_decided_${payment.id}`,
        },
  );
  return { status };
}

// ── Admins: export for the accounts ──

const EXPORT_LIMIT = 10_000;
const STATUS_TEXT: Record<ManualPaymentStatus, string> = {
  PENDING: "Waiting",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** "2026-10-31" → "2026-11-01". */
const nextDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Payments reported between `from` and `to` (local dates in the admin's time zone, inclusive) as CSV, oldest
 * first. Amounts are plain rupee numbers so spreadsheets can add them up. Holds names and emails: audited.
 */
export async function paymentsCsv(
  deps: Deps,
  actor: Actor,
  query: PaymentsExportQuery,
): Promise<{ filename: string; csv: string }> {
  assertCan(actor.role, "user:manage");
  const tz = actor.timezone;
  const rows = await deps.db.manualPayment.findMany({
    where: {
      createdAt: {
        gte: zonedInputToUtc(`${query.from}T00:00`, tz),
        lt: zonedInputToUtc(`${nextDay(query.to)}T00:00`, tz),
      },
      ...(query.status === "ALL" ? {} : { status: query.status }),
    },
    orderBy: { createdAt: "asc" },
    take: EXPORT_LIMIT + 1,
    select: {
      status: true,
      reference: true,
      amountInPaise: true,
      createdAt: true,
      note: true,
      decidedAt: true,
      decisionNote: true,
      decidedBy: { select: { name: true } },
      payerName: true,
      payerEmail: true,
      courseTitle: true,
    },
  });
  if (rows.length > EXPORT_LIMIT) throw Errors.validation("Too many payments: export a shorter period.");
  const when = (d: Date | null) => (d ? utcToZonedInput(d, tz).replace("T", " ") : null);
  const header = [
    "Reported at",
    "Status",
    "Amount (₹)",
    "UPI reference (UTR)",
    "Student",
    "Email",
    "Course",
    "Student's note",
    "Decided at",
    "Decided by",
    "Decision note",
  ];
  const lines = rows.map((r) => [
    when(r.createdAt),
    STATUS_TEXT[r.status],
    r.amountInPaise / 100,
    r.reference,
    r.payerName,
    r.payerEmail,
    r.courseTitle,
    r.note,
    when(r.decidedAt),
    r.decidedBy?.name ?? null,
    r.decisionNote,
  ]);
  await audit(
    deps.db,
    actor,
    "payment.export",
    { type: "PaymentSettings", id: "1" },
    { from: query.from, to: query.to, status: query.status, rows: lines.length },
  );
  return { filename: `payments-${query.from}-to-${query.to}.csv`, csv: toCsv([header, ...lines]) };
}
