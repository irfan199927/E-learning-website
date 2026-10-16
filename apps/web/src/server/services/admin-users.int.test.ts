import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { makeDeps, testDb, world } from "@/test/fakes";
import { createUsers, listUsers, resendInvite, updateUser } from "./admin-users";
import { listRoster, removeStudent } from "./roster";

const tag = () => randomUUID().slice(0, 8);

describe("admin users (integration)", () => {
  it("adds people, skips existing emails, and emails each new person a set-password link", async () => {
    const w = await world();
    const sent: string[] = [];
    const deps = makeDeps({ sendPasswordSetup: async (email) => void sent.push(email) });
    const t = tag();
    const { results } = await createUsers(deps, w.admin, {
      users: [
        { email: `new-${t}@x.in`, name: "New Teacher", role: "TEACHER" },
        { email: w.student.email, name: "Already Here", role: "ADMIN" },
      ],
    });
    expect(results).toEqual([
      { email: `new-${t}@x.in`, status: "created" },
      { email: w.student.email, status: "exists" },
    ]);
    expect(sent).toEqual([`new-${t}@x.in`]);
    const created = await testDb().user.findUniqueOrThrow({ where: { email: `new-${t}@x.in` } });
    expect(created).toMatchObject({ role: "TEACHER", isActive: true, emailVerified: true });
    // The existing account was not touched.
    expect((await testDb().user.findUniqueOrThrow({ where: { id: w.student.id } })).role).toBe("STUDENT");

    // A failing mail server doesn't lose the account; the admin can resend.
    const failing = makeDeps({ sendPasswordSetup: async () => Promise.reject(new Error("smtp down")) });
    const r2 = await createUsers(failing, w.admin, {
      users: [{ email: `m-${t}@x.in`, name: "M", role: "STUDENT" }],
    });
    expect(r2.results[0]!.status).toBe("email-failed");
    await resendInvite(
      deps,
      w.admin,
      (await testDb().user.findUniqueOrThrow({ where: { email: `m-${t}@x.in` } })).id,
    );
    expect(sent).toContain(`m-${t}@x.in`);
  });

  it("searches and filters, and only admins may manage users", async () => {
    const w = await world();
    const deps = makeDeps();
    const found = await listUsers(deps, w.admin, { q: w.teacher.email.toUpperCase(), page: 1 });
    // Case-insensitive "contains": the other-teacher fixture's email contains this one too.
    expect(found.users.map((u) => u.id).sort()).toEqual([w.teacher.id, w.otherTeacher.id].sort());
    expect(found.users.find((u) => u.id === w.teacher.id)!.courseCount).toBe(1);
    const students = await listUsers(deps, w.admin, { role: "STUDENT", page: 1 });
    expect(students.users.every((u) => u.role === "STUDENT")).toBe(true);
    for (const who of [w.teacher, w.student, w.parent]) {
      await expect(listUsers(deps, who, { page: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(updateUser(deps, who, w.outsider.id, { role: "ADMIN" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });

  it("changes roles, and deactivating signs the person out", async () => {
    const w = await world();
    const deps = makeDeps();
    const db = testDb();
    await updateUser(deps, w.admin, w.outsider.id, { role: "TEACHER" });
    expect((await db.user.findUniqueOrThrow({ where: { id: w.outsider.id } })).role).toBe("TEACHER");

    await db.session.create({
      data: { userId: w.outsider.id, token: `t-${tag()}`, expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await updateUser(deps, w.admin, w.outsider.id, { isActive: false });
    expect(await db.session.count({ where: { userId: w.outsider.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: w.outsider.id } })).isActive).toBe(false);
    const audit = await db.auditLog.findMany({
      where: { targetId: w.outsider.id },
      select: { action: true },
    });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["user.role", "user.deactivate"]));
  });

  it("never lets an admin lock themselves out", async () => {
    const w = await world();
    const deps = makeDeps();
    await expect(updateUser(deps, w.admin, w.admin.id, { role: "TEACHER" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(updateUser(deps, w.admin, w.admin.id, { isActive: false })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(updateUser(deps, w.admin, "nope", { role: "ADMIN" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("course roster (integration)", () => {
  it("the teacher sees enrolled students and can remove one, who then loses access", async () => {
    const w = await world();
    const deps = makeDeps();
    const roster = await listRoster(deps, w.teacher, w.course.id);
    expect(roster.map((s) => s.userId)).toEqual([w.student.id]);

    await expect(removeStudent(deps, w.otherTeacher, w.course.id, w.student.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await removeStudent(deps, w.teacher, w.course.id, w.student.id);
    expect(await listRoster(deps, w.teacher, w.course.id)).toEqual([]);
    const e = await testDb().enrollment.findFirstOrThrow({
      where: { courseId: w.course.id, userId: w.student.id },
    });
    expect(e.revokedAt).not.toBeNull();
    await expect(removeStudent(deps, w.teacher, w.course.id, w.student.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
