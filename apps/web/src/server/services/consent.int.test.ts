import { createMemoryMailer } from "@elearner/notify";
import { describe, expect, it } from "vitest";
import { makeDeps, testDb, world } from "@/test/fakes";
import {
  getConsentState,
  grantConsent,
  requestParentConsent,
  setDateOfBirth,
  viewConsentRequest,
} from "./consent";
import { decideJoinRequest, listJoinRequests, requestToJoin } from "./join-requests";

const NOW = new Date("2026-10-16T09:00:00Z");

/** A student with no date of birth yet (like a fresh Google sign-up). */
async function freshStudent(w: Awaited<ReturnType<typeof world>>) {
  await testDb().user.update({ where: { id: w.outsider.id }, data: { dateOfBirth: null, isMinor: false } });
  await testDb().course.update({ where: { id: w.course.id }, data: { publishedAt: new Date() } });
  return w.outsider;
}
const tokenFrom = (text: string) => text.match(/\/consent\/([A-Za-z0-9_-]+)/)![1]!;

describe("parental consent (integration)", () => {
  it("asks for a date of birth first, and lets adults through", async () => {
    const w = await world();
    const deps = makeDeps({ now: () => NOW });
    const s = await freshStudent(w);
    expect(await getConsentState(deps, s.id)).toEqual({ kind: "needs-dob" });
    await expect(requestToJoin(deps, s, w.course.id, {})).rejects.toThrow(/date of birth/);

    expect(await setDateOfBirth(deps, s, { dateOfBirth: new Date("2005-03-01T00:00:00Z") })).toEqual({
      kind: "not-needed",
    });
    await expect(
      setDateOfBirth(deps, s, { dateOfBirth: new Date("2012-01-01T00:00:00Z") }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await requestToJoin(deps, s, w.course.id, {});
    // Teachers and parents are never asked.
    expect(await getConsentState(deps, w.teacher.id)).toEqual({ kind: "not-needed" });
  });

  it("a minor can't join until a parent gives consent through the emailed link", async () => {
    const w = await world();
    const mailer = createMemoryMailer();
    const deps = makeDeps({ now: () => NOW, mailer });
    const s = await freshStudent(w);
    const db = testDb();
    await setDateOfBirth(deps, s, { dateOfBirth: new Date("2012-06-15T00:00:00Z") });
    expect(await getConsentState(deps, s.id)).toEqual({ kind: "needs-consent", pendingEmail: null });
    await expect(requestToJoin(deps, s, w.course.id, {})).rejects.toThrow(/parent needs to approve/);

    // A teacher can't sneak them in either (e.g. a request made before the DOB was known).
    await db.joinRequest.create({ data: { userId: s.id, courseId: w.course.id } });
    const [pending] = await listJoinRequests(deps, w.teacher, w.course.id);
    await expect(decideJoinRequest(deps, w.teacher, pending!.id, { decision: "approve" })).rejects.toThrow(
      /parent hasn't given consent/,
    );

    await expect(requestParentConsent(deps, s, { parentEmail: s.email })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await requestParentConsent(deps, s, { parentEmail: "mum@example.com" });
    expect(await getConsentState(deps, s.id)).toEqual({
      kind: "needs-consent",
      pendingEmail: "mum@example.com",
    });
    const mail = mailer.sent.at(-1)!;
    expect(mail.to).toBe("mum@example.com");
    const token = tokenFrom(mail.message.text);
    expect(await viewConsentRequest(deps, token)).toMatchObject({ status: "open", studentName: "outsider" });

    await grantConsent(deps, token, { parentName: "Sunita Sharma", declaration: true }, "203.0.113.7");
    const consent = await db.consent.findFirstOrThrow({
      where: { userId: s.id, type: "PARENTAL_VERIFIABLE" },
    });
    expect(consent).toMatchObject({
      parentName: "Sunita Sharma",
      parentEmail: "mum@example.com",
      method: "parent-email-link",
      ipAddress: "203.0.113.7",
      withdrawnAt: null,
    });
    expect(consent.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await getConsentState(deps, s.id)).toMatchObject({ kind: "given", parentName: "Sunita Sharma" });

    // Single use; then the teacher's approval goes through.
    await expect(grantConsent(deps, token, { parentName: "X", declaration: true }, null)).rejects.toThrow(
      /already given/,
    );
    expect((await viewConsentRequest(deps, token)).status).toBe("used");
    await decideJoinRequest(deps, w.teacher, pending!.id, { decision: "approve" });
  });

  it("links expire, a new link replaces the old one, and unknown tokens reveal nothing", async () => {
    const w = await world();
    const mailer = createMemoryMailer();
    let now = NOW;
    const deps = makeDeps({ now: () => now, mailer });
    const s = await freshStudent(w);
    await setDateOfBirth(deps, s, { dateOfBirth: new Date("2013-01-01T00:00:00Z") });
    await requestParentConsent(deps, s, { parentEmail: "dad@example.com" });
    const first = tokenFrom(mailer.sent.at(-1)!.message.text);
    await requestParentConsent(deps, s, { parentEmail: "dad@example.com" });
    const second = tokenFrom(mailer.sent.at(-1)!.message.text);
    expect((await viewConsentRequest(deps, first)).status).toBe("expired");

    now = new Date(NOW.getTime() + 8 * 86_400_000);
    expect((await viewConsentRequest(deps, second)).status).toBe("expired");
    await expect(grantConsent(deps, second, { parentName: "Dad", declaration: true }, null)).rejects.toThrow(
      /expired/,
    );
    expect(await viewConsentRequest(deps, "not-a-real-token")).toEqual({ status: "invalid" });
    await expect(
      grantConsent(deps, "not-a-real-token", { parentName: "Dad", declaration: true }, null),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
