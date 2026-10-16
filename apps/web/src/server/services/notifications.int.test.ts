import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { makeDeps, world } from "@/test/fakes";
import { createAssignment, updateAssignment } from "./assignments";
import { requestToJoin } from "./join-requests";
import {
  listNotifications,
  markAllRead,
  markRead,
  notifyUsers,
  safeLink,
  unreadCount,
} from "./notifications";

describe("notifications (integration)", () => {
  it("lists only your own, marks them read, and only follows same-site links", async () => {
    const w = await world();
    const deps = makeDeps();
    await notifyUsers(deps, [w.student.id], { type: "t", title: "One", body: "b", link: "/courses" });
    await notifyUsers(deps, [w.student.id], { type: "t", title: "Two", body: "b", link: "//evil.example" });
    await notifyUsers(deps, [w.outsider.id], { type: "t", title: "Not yours", body: "b", link: "/x" });

    const page = await listNotifications(deps, w.student);
    expect(page.items.map((n) => [n.title, n.link])).toEqual([
      ["Two", null],
      ["One", "/courses"],
    ]);
    expect(page.unread).toBe(2);

    const one = page.items.find((n) => n.title === "One")!;
    expect(await markRead(deps, w.student, one.id)).toEqual({ link: "/courses" });
    expect(await unreadCount(deps, w.student)).toBe(1);
    const theirs = (await listNotifications(deps, w.outsider)).items[0]!;
    await expect(markRead(deps, w.student, theirs.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(await markAllRead(deps, w.student)).toEqual({ marked: 1 });
    expect(await unreadCount(deps, w.student)).toBe(0);
    expect(await unreadCount(deps, w.outsider)).toBe(1);

    expect(safeLink("/a?b=1")).toBe("/a?b=1");
    for (const bad of ["https://x.y", "//x.y", "/\\x.y", "javascript:alert(1)", null])
      expect(safeLink(bad)).toBeNull();
  });

  it("tells the teacher about join requests and students about new work, once", async () => {
    const w = await world();
    const deps = makeDeps();
    const course = await deps.db.course.create({
      data: { slug: `c-${randomUUID()}`, title: "Physics", teacherId: w.teacher.id, publishedAt: new Date() },
    });
    await requestToJoin(deps, w.outsider, course.id, { message: "Please let me in" });
    const teacher = await listNotifications(deps, w.teacher);
    expect(teacher.items[0]).toMatchObject({
      title: `${w.outsider.name} asked to join Physics`,
      body: "Please let me in",
      link: `/courses/${course.id}#join-requests`,
    });

    // A draft says nothing; publishing it tells the course's students once.
    const base = {
      title: "Lab report",
      instructions: "Write it up.",
      dueAt: new Date(Date.now() + 86_400_000),
      maxPoints: 10,
      allowText: true,
      allowFile: false,
      allowLate: false,
    };
    const draft = await createAssignment(deps, w.teacher, w.course.id, { ...base, published: false });
    const count = () =>
      deps.db.notification.count({ where: { userId: w.student.id, type: "assignment.published" } });
    expect(await count()).toBe(0);
    await updateAssignment(deps, w.teacher, draft.id, { published: true });
    await updateAssignment(deps, w.teacher, draft.id, { published: false });
    await updateAssignment(deps, w.teacher, draft.id, { published: true });
    expect(await count()).toBe(1);
    expect(
      (await listNotifications(deps, w.outsider)).items.some((n) => n.title.includes("Lab report")),
    ).toBe(false);
  });
});
