import { describe, expect, it } from "vitest";
import { makeDeps, world } from "@/test/fakes";
import { hasCourseAccess } from "../policies";
import { decideJoinRequest, requestToJoin } from "./join-requests";

// Regressions from the 2026-10-18 security review.
describe("security review fixes (integration)", () => {
  it("a teacher moved to another role loses their courses", async () => {
    const w = await world();
    const deps = makeDeps();
    expect(await hasCourseAccess(deps.db, w.teacher, w.course.id, "manage")).toBe(true);
    for (const role of ["STUDENT", "PARENT"] as const)
      expect(await hasCourseAccess(deps.db, { ...w.teacher, role }, w.course.id, "watch")).toBe(false);
  });

  it("a join request can't be approved for free once the course has a price", async () => {
    const w = await world();
    const deps = makeDeps();
    await deps.db.course.update({ where: { id: w.course.id }, data: { publishedAt: new Date() } });
    await requestToJoin(deps, w.outsider, w.course.id, {});
    const { id } = await deps.db.joinRequest.findFirstOrThrow({
      where: { userId: w.outsider.id, courseId: w.course.id },
    });
    await deps.db.course.update({ where: { id: w.course.id }, data: { isPaid: true, priceInPaise: 49_900 } });
    await expect(decideJoinRequest(deps, w.teacher, id, { decision: "approve" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    // Declining still works.
    expect(await decideJoinRequest(deps, w.teacher, id, { decision: "decline" })).toEqual({
      status: "declined",
    });
  });
});
