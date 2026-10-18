import { describe, expect, it } from "vitest";
import { fakeStorage, makeDeps, world } from "@/test/fakes";
import { hasCourseAccess } from "../policies";
import { listCatalog, requestToJoin } from "./join-requests";
import {
  decidePayment,
  getCoursePayment,
  initProofUpload,
  listPayments,
  paymentsCsv,
  proofUrl,
  setCoursePrice,
  submitPayment,
  updatePaymentSettings,
} from "./payments";

/** UTRs are unique across the shared dev database, so every run makes its own. */
const utr = () => String(Math.floor(1e11 + Math.random() * 9e11));

describe("manual UPI payments (integration)", () => {
  it("a student pays by UPI, an admin rejects then approves, and approval enrols them", async () => {
    const w = await world();
    const storage = fakeStorage();
    const deps = makeDeps({ storage });
    const db = deps.db;
    await db.course.update({ where: { id: w.course.id }, data: { publishedAt: new Date() } });

    // Only admins publish the school's UPI details and set prices.
    await expect(updatePaymentSettings(deps, w.teacher, { upiId: "school@okaxis" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await updatePaymentSettings(deps, w.admin, { upiId: "school@okaxis", payeeName: "Sunrise School" });
    await expect(setCoursePrice(deps, w.teacher, w.course.id, { priceRupees: 1500 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await setCoursePrice(deps, w.admin, w.course.id, { priceRupees: 1500 })).toEqual({
      priceInPaise: 150_000,
    });

    // A paid course can't be joined by asking; the catalog shows the price.
    await expect(requestToJoin(deps, w.outsider, w.course.id, {})).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const card = (await listCatalog(deps, w.outsider, { q: w.course.title })).find(
      (c) => c.id === w.course.id,
    );
    expect(card).toMatchObject({ priceInPaise: 150_000, payment: null });
    const page = await getCoursePayment(deps, w.outsider, w.course.id);
    expect(page).toMatchObject({
      course: { priceInPaise: 150_000 },
      settings: { upiId: "school@okaxis", ready: true },
      enrolled: false,
      latest: null,
    });

    // A screenshot that never reached storage is refused; one that did is attached.
    const ghost = await initProofUpload(deps, w.outsider, { mimeType: "image/png", sizeBytes: 100 });
    await expect(
      submitPayment(deps, w.outsider, w.course.id, {
        reference: utr(),
        proof: { proofId: ghost.proofId, mimeType: "image/png" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const shot = await initProofUpload(deps, w.outsider, { mimeType: "image/png", sizeBytes: 100 });
    storage.sizes.set(`payments/proofs/${w.outsider.id}/${shot.proofId}.png`, 100);
    const firstRef = utr();
    const first = await submitPayment(deps, w.outsider, w.course.id, {
      reference: firstRef,
      proof: { proofId: shot.proofId, mimeType: "image/png" },
    });
    expect(first).toMatchObject({ status: "PENDING", amountInPaise: 150_000 });
    await expect(submitPayment(deps, w.outsider, w.course.id, { reference: utr() })).rejects.toMatchObject({
      code: "CONFLICT", // already waiting
    });
    expect(
      await db.notification.count({
        where: { userId: w.admin.id, type: "payment.submitted", link: "/admin/payments" },
      }),
    ).toBeGreaterThan(0);
    expect((await listCatalog(deps, w.outsider, { q: w.course.title }))[0]?.payment).toBe("PENDING");

    const pending = await listPayments(deps, w.admin, { status: "PENDING" });
    expect(pending.find((p) => p.id === first.id)).toMatchObject({
      reference: firstRef,
      hasProof: true,
      student: { id: w.outsider.id },
    });
    expect(await proofUrl(deps, w.admin, first.id)).toContain(shot.proofId);
    await expect(listPayments(deps, w.student, { status: "PENDING" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // Reject with a reason; deciding twice is refused; the student is told why.
    await decidePayment(deps, w.admin, first.id, { decision: "reject", note: "No payment with this UTR" });
    await expect(decidePayment(deps, w.admin, first.id, { decision: "approve" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect((await getCoursePayment(deps, w.outsider, w.course.id)).latest).toMatchObject({
      status: "REJECTED",
      decisionNote: "No payment with this UTR",
    });
    expect(await hasCourseAccess(db, w.outsider, w.course.id, "watch")).toBe(false);

    // The same UTR can't be reported twice, even by someone else.
    await db.enrollment.updateMany({
      where: { userId: w.student.id, courseId: w.course.id },
      data: { revokedAt: new Date() },
    });
    await expect(submitPayment(deps, w.student, w.course.id, { reference: firstRef })).rejects.toMatchObject({
      code: "CONFLICT",
    });

    // A corrected report, approved: the student is enrolled and told.
    const second = await submitPayment(deps, w.outsider, w.course.id, {
      reference: utr(),
      note: "Paid from my mother's phone",
    });
    await decidePayment(deps, w.admin, second.id, { decision: "approve" });
    expect(await hasCourseAccess(db, w.outsider, w.course.id, "watch")).toBe(true);
    expect(await db.notification.count({ where: { userId: w.outsider.id, type: "payment.approved" } })).toBe(
      1,
    );
    await expect(submitPayment(deps, w.outsider, w.course.id, { reference: utr() })).rejects.toMatchObject({
      code: "CONFLICT", // already in
    });
    const actions = await db.auditLog.findMany({
      where: { targetId: { in: [first.id, second.id] } },
      select: { action: true },
    });
    expect(actions.map((a) => a.action).sort()).toEqual([
      "payment.approve",
      "payment.reject",
      "payment.submit",
      "payment.submit",
    ]);

    // Free again: asking to join works.
    await setCoursePrice(deps, w.admin, w.course.id, { priceRupees: 0 });
    await expect(getCoursePayment(deps, w.student, w.course.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(requestToJoin(deps, w.student, w.course.id, {})).resolves.toEqual({ status: "pending" });
  });

  it("keeps a payment record after the student's account is deleted, with their name copied", async () => {
    const w = await world();
    const deps = makeDeps();
    const db = deps.db;
    await db.course.update({ where: { id: w.course.id }, data: { publishedAt: new Date() } });
    await updatePaymentSettings(deps, w.admin, { upiId: "school@okaxis" });
    await setCoursePrice(deps, w.admin, w.course.id, { priceRupees: 900 });
    const paid = await submitPayment(deps, w.outsider, w.course.id, { reference: utr() });

    await db.user.delete({ where: { id: w.outsider.id } }); // what the erasure job does after the grace period

    const row = (await listPayments(deps, w.admin, { status: "PENDING" })).find((p) => p.id === paid.id);
    expect(row).toMatchObject({
      student: { id: null, name: w.outsider.name, email: w.outsider.email },
      course: { id: w.course.id, title: w.course.title },
      amountInPaise: 90_000,
    });
    await expect(decidePayment(deps, w.admin, paid.id, { decision: "approve" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("exports payments in a date range as CSV, by the admin's local dates", async () => {
    const w = await world();
    const deps = makeDeps();
    const db = deps.db;
    await db.course.update({ where: { id: w.course.id }, data: { publishedAt: new Date() } });
    await updatePaymentSettings(deps, w.admin, { upiId: "school@okaxis" });
    await setCoursePrice(deps, w.admin, w.course.id, { priceRupees: 1500 });
    const ref = utr();
    const paid = await submitPayment(deps, w.outsider, w.course.id, { reference: ref, note: "=cmd|calc" });
    // 19:00 UTC on 31 Jan is 00:30 on 1 Feb in India: it belongs to February for an IST admin.
    await db.manualPayment.update({
      where: { id: paid.id },
      data: { createdAt: new Date("2026-01-31T19:00:00Z") },
    });

    const feb = await paymentsCsv(deps, w.admin, { from: "2026-02-01", to: "2026-02-28", status: "ALL" });
    expect(feb.filename).toBe("payments-2026-02-01-to-2026-02-28.csv");
    const line = feb.csv.split("\r\n").find((l) => l.includes(ref));
    expect(line).toBe(
      `2026-02-01 00:30,Waiting,1500,${ref},${w.outsider.name},${w.outsider.email},${w.course.title},'=cmd|calc,,,`,
    );
    const jan = await paymentsCsv(deps, w.admin, { from: "2026-01-01", to: "2026-01-31", status: "ALL" });
    expect(jan.csv).not.toContain(ref);
    const approvedOnly = await paymentsCsv(deps, w.admin, {
      from: "2026-02-01",
      to: "2026-02-01",
      status: "APPROVED",
    });
    expect(approvedOnly.csv).not.toContain(ref);

    expect(await db.auditLog.count({ where: { actorId: w.admin.id, action: "payment.export" } })).toBe(3);
    await expect(
      paymentsCsv(deps, w.teacher, { from: "2026-02-01", to: "2026-02-28", status: "ALL" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
