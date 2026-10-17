import { randomUUID } from "node:crypto";
import { erasureDate } from "@elearner/core";
import type { createMemoryMailer } from "@elearner/notify";
import { describe, expect, it } from "vitest";
import { makeDeps, world } from "@/test/fakes";
import {
  cancelAccountDeletion,
  getAccount,
  requestAccountDeletion,
  setEmailDigest,
  setLocale,
} from "./account";
import { listUsers } from "./admin-users";

describe("account deletion (integration)", () => {
  it("lets a student delete their account, signs them out, and lets an admin cancel it", async () => {
    const w = await world();
    const deps = makeDeps();
    const db = deps.db;
    const mailer = deps.mailer as ReturnType<typeof createMemoryMailer>;

    expect(await getAccount(deps, w.student)).toMatchObject({ role: "STUDENT", canDelete: true });
    expect((await getAccount(deps, w.teacher)).canDelete).toBe(false);
    await expect(requestAccountDeletion(deps, w.teacher, { confirm: "DELETE" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await db.session.create({
      data: { token: randomUUID(), userId: w.student.id, expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const { purgeOn } = await requestAccountDeletion(deps, w.student, { confirm: "DELETE" });
    const user = await db.user.findUniqueOrThrow({ where: { id: w.student.id } });
    expect(user.deletedAt).toBeInstanceOf(Date);
    expect(purgeOn).toEqual(erasureDate(user.deletedAt!));
    expect(await db.session.count({ where: { userId: w.student.id } })).toBe(0); // signed out everywhere
    expect(mailer.sent.map((m) => [m.to, m.message.subject])).toEqual([
      [w.student.email, "Your E-learner account will be deleted"],
    ]);
    await expect(requestAccountDeletion(deps, w.student, { confirm: "DELETE" })).rejects.toMatchObject({
      code: "CONFLICT",
    });

    // Admins see the pending deletion and can cancel it before the purge.
    const listed = await listUsers(deps, w.admin, { q: w.student.email, page: 1 });
    expect(listed.users[0]).toMatchObject({ id: w.student.id, purgeOn });
    await expect(cancelAccountDeletion(deps, w.teacher, w.student.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await cancelAccountDeletion(deps, w.admin, w.student.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: w.student.id } })).deletedAt).toBeNull();
    await expect(cancelAccountDeletion(deps, w.admin, w.student.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const actions = await db.auditLog.findMany({
      where: { targetId: w.student.id, action: { in: ["user.delete_request", "user.restore"] } },
      select: { action: true, actorId: true },
    });
    expect(actions).toHaveLength(2);
    expect(actions).toEqual(
      expect.arrayContaining([
        { action: "user.delete_request", actorId: w.student.id },
        { action: "user.restore", actorId: w.admin.id },
      ]),
    );
  });

  it("lets anyone switch the daily notification email off and on", async () => {
    const w = await world();
    const deps = makeDeps();
    expect((await getAccount(deps, w.teacher)).emailDigest).toBe(true); // on by default
    expect(await setEmailDigest(deps, w.teacher, { enabled: false })).toEqual({ emailDigest: false });
    expect((await getAccount(deps, w.teacher)).emailDigest).toBe(false);
    expect((await getAccount(deps, w.student)).emailDigest).toBe(true); // only their own
    await setEmailDigest(deps, w.teacher, { enabled: true });
    expect((await getAccount(deps, w.teacher)).emailDigest).toBe(true);
  });

  it("emails in the language the person chose", async () => {
    const w = await world();
    const deps = makeDeps();
    const mailer = deps.mailer as ReturnType<typeof createMemoryMailer>;
    expect(await setLocale(deps, w.student, { locale: "hi" })).toEqual({ locale: "hi" });
    await requestAccountDeletion(deps, w.student, { confirm: "DELETE" });
    const mail = mailer.sent.find((m) => m.to === w.student.email)!.message;
    expect(mail.subject).toBe("आपका E-learner खाता हटा दिया जाएगा");
    expect(mail.text).toMatch(/^नमस्ते /);
  });
});
