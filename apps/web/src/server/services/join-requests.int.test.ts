import { describe, expect, it } from "vitest";
import { makeDeps, testDb, world } from "@/test/fakes";
import { hasCourseAccess } from "../policies";
import {
  createCourse,
  decideJoinRequest,
  listCatalog,
  listJoinRequests,
  pendingJoinCounts,
  requestToJoin,
} from "./join-requests";

async function publish(courseId: string) {
  await testDb().course.update({ where: { id: courseId }, data: { publishedAt: new Date() } });
}

describe("join requests (integration)", () => {
  it("a student asks, the teacher approves, and only then can the student open the course", async () => {
    const w = await world();
    const deps = makeDeps();
    await publish(w.course.id);
    const db = testDb();

    expect(await hasCourseAccess(db, w.outsider, w.course.id, "watch")).toBe(false);
    expect((await listCatalog(deps, w.outsider)).find((c) => c.id === w.course.id)?.state).toBe("none");

    await requestToJoin(deps, w.outsider, w.course.id, { message: "I'm in class 9-A" });
    expect((await listCatalog(deps, w.outsider)).find((c) => c.id === w.course.id)?.state).toBe("pending");
    // Still no access while pending.
    expect(await hasCourseAccess(db, w.outsider, w.course.id, "watch")).toBe(false);

    const pending = await listJoinRequests(deps, w.teacher, w.course.id);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ message: "I'm in class 9-A", student: { name: "outsider" } });
    expect((await pendingJoinCounts(deps, w.teacher)).get(w.course.id)).toBe(1);

    await decideJoinRequest(deps, w.teacher, pending[0]!.id, { decision: "approve" });
    expect(await hasCourseAccess(db, w.outsider, w.course.id, "watch")).toBe(true);
    expect((await listCatalog(deps, w.outsider)).find((c) => c.id === w.course.id)?.state).toBe("enrolled");
    expect(await listJoinRequests(deps, w.teacher, w.course.id)).toHaveLength(0);
    const note = await db.notification.findFirst({
      where: { userId: w.outsider.id, type: "course.join.approved" },
    });
    expect(note?.link).toBe(`/courses/${w.course.id}`);

    // Answering twice, or asking again once enrolled, is a conflict.
    await expect(
      decideJoinRequest(deps, w.teacher, pending[0]!.id, { decision: "decline" }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(requestToJoin(deps, w.outsider, w.course.id, {})).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("declines keep the student out, and they may ask again", async () => {
    const w = await world();
    const deps = makeDeps();
    await publish(w.course.id);
    await requestToJoin(deps, w.outsider, w.course.id, {});
    const [req] = await listJoinRequests(deps, w.teacher, w.course.id);
    await decideJoinRequest(deps, w.teacher, req!.id, { decision: "decline" });
    expect(await hasCourseAccess(testDb(), w.outsider, w.course.id, "watch")).toBe(false);
    expect((await listCatalog(deps, w.outsider)).find((c) => c.id === w.course.id)?.state).toBe("declined");

    await requestToJoin(deps, w.outsider, w.course.id, {});
    expect(await listJoinRequests(deps, w.teacher, w.course.id)).toHaveLength(1);
  });

  it("only the course's teacher or an admin can see and answer requests", async () => {
    const w = await world();
    const deps = makeDeps();
    await publish(w.course.id);
    await requestToJoin(deps, w.outsider, w.course.id, {});
    const [req] = await listJoinRequests(deps, w.admin, w.course.id);

    await expect(listJoinRequests(deps, w.otherTeacher, w.course.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      decideJoinRequest(deps, w.otherTeacher, req!.id, { decision: "approve" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(decideJoinRequest(deps, w.student, req!.id, { decision: "approve" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(requestToJoin(deps, w.teacher, w.course.id, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await decideJoinRequest(deps, w.admin, req!.id, { decision: "approve" });
  });

  it("unpublished courses can't be requested and don't appear in the catalog", async () => {
    const w = await world();
    const deps = makeDeps();
    expect((await listCatalog(deps, w.outsider)).some((c) => c.id === w.course.id)).toBe(false);
    await expect(requestToJoin(deps, w.outsider, w.course.id, {})).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("teachers create published courses they own", async () => {
    const w = await world();
    const deps = makeDeps();
    const { id } = await createCourse(deps, w.teacher, { title: "Physics: Motion & Forces", grade: "9" });
    const course = await testDb().course.findUniqueOrThrow({ where: { id } });
    expect(course).toMatchObject({ teacherId: w.teacher.id, grade: "9" });
    expect(course.publishedAt).not.toBeNull();
    expect(course.slug).toMatch(/^physics-motion-forces-[0-9a-f]{6}$/);
    await expect(createCourse(deps, w.student, { title: "Nope" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
