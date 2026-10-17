import { RECORDING_NOTICE_VERSION } from "@elearner/core";
import { describe, expect, it } from "vitest";
import { makeDeps, world } from "@/test/fakes";
import { getAttendanceSheet } from "./attendance";
import {
  agreeToRecording,
  getRecordingConsent,
  mayJoinRecordedClasses,
  recordingConsentFor,
  withdrawRecordingConsent,
} from "./recording-consent";

describe("recording consent (integration)", () => {
  it("records agreement to the current notice, lets students withdraw, and is audited", async () => {
    const w = await world();
    const deps = makeDeps();
    const db = deps.db;

    expect(await getRecordingConsent(deps, w.student)).toMatchObject({ status: "none", agreedAt: null });
    expect(await mayJoinRecordedClasses(db, w.student)).toBe(false);
    expect(await mayJoinRecordedClasses(db, w.teacher)).toBe(true); // staff never need to agree

    // Agreeing to text the student wasn't shown (an old version) is refused.
    await expect(agreeToRecording(deps, w.student, { version: "2000-01-01" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const agreed = await agreeToRecording(deps, w.student, { version: RECORDING_NOTICE_VERSION });
    expect(agreed).toMatchObject({ status: "agreed", version: RECORDING_NOTICE_VERSION });
    expect(agreed.agreedAt).toBeInstanceOf(Date);
    await agreeToRecording(deps, w.student, { version: RECORDING_NOTICE_VERSION }); // no second row
    expect(await db.consent.count({ where: { userId: w.student.id, type: "RECORDING" } })).toBe(1);
    expect(await mayJoinRecordedClasses(db, w.student)).toBe(true);

    // An agreement to an older notice is outdated: the student is asked again.
    await db.consent.updateMany({ where: { userId: w.student.id }, data: { version: "2000-01-01" } });
    expect((await getRecordingConsent(deps, w.student)).status).toBe("outdated");
    expect(await mayJoinRecordedClasses(db, w.student)).toBe(false);
    await agreeToRecording(deps, w.student, { version: RECORDING_NOTICE_VERSION });

    expect(await withdrawRecordingConsent(deps, w.student)).toMatchObject({ status: "withdrawn" });
    expect(await db.consent.count({ where: { userId: w.student.id, withdrawnAt: null } })).toBe(0);
    expect(await mayJoinRecordedClasses(db, w.student)).toBe(false);

    const actions = await db.auditLog.findMany({
      where: { actorId: w.student.id, action: { startsWith: "consent." } },
      select: { action: true },
    });
    expect(actions.map((a) => a.action).sort()).toEqual([
      "consent.grant",
      "consent.grant",
      "consent.withdraw",
    ]);

    for (const other of [w.teacher, w.parent, w.admin])
      await expect(getRecordingConsent(deps, other)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await recordingConsentFor(db, [w.student.id, w.outsider.id])).toEqual(
      new Map([
        [w.student.id, "withdrawn"],
        [w.outsider.id, "none"],
      ]),
    );
  });

  it("shows teachers who hasn't agreed on the attendance sheet", async () => {
    const w = await world();
    const deps = makeDeps();
    const cls = await deps.db.classSession.create({
      data: {
        courseId: w.course.id,
        hostId: w.teacher.id,
        title: "Past class",
        startsAt: new Date(Date.now() - 2 * 3600_000),
        endsAt: new Date(Date.now() - 3600_000),
      },
    });
    let sheet = await getAttendanceSheet(deps, w.teacher, cls.id);
    expect(sheet.rows.map((r) => [r.userId, r.recordingConsent])).toEqual([[w.student.id, false]]);
    await agreeToRecording(deps, w.student, { version: RECORDING_NOTICE_VERSION });
    sheet = await getAttendanceSheet(deps, w.teacher, cls.id);
    expect(sheet.rows[0]!.recordingConsent).toBe(true);
  });
});
