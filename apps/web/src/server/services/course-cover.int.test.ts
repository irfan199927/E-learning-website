import { COVER_MAX_BYTES } from "@elearner/core";
import { describe, expect, it } from "vitest";
import { fakeStorage, makeDeps, world } from "@/test/fakes";
import { completeCoverUpload, coverUrl, initCoverUpload, removeCover } from "./course-cover";
import { listCatalog } from "./join-requests";

describe("course covers and catalog search (integration)", () => {
  it("uploads, replaces and removes a cover; only staff manage it; drafts stay private", async () => {
    const w = await world();
    const storage = fakeStorage();
    const deps = makeDeps({ storage });
    const db = deps.db;

    await expect(
      initCoverUpload(deps, w.otherTeacher, w.course.id, { mimeType: "image/png", sizeBytes: 10 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      initCoverUpload(deps, w.student, w.course.id, { mimeType: "image/png", sizeBytes: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const first = await initCoverUpload(deps, w.teacher, w.course.id, {
      mimeType: "image/png",
      sizeBytes: 10,
    });
    expect(first.uploadUrl).toContain(`courses/${w.course.id}/cover/${first.coverId}.png`);
    // Not uploaded yet: refused.
    await expect(
      completeCoverUpload(deps, w.teacher, w.course.id, { coverId: first.coverId, mimeType: "image/png" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const firstKey = `courses/${w.course.id}/cover/${first.coverId}.png`;
    storage.sizes.set(firstKey, 5000);
    const saved = await completeCoverUpload(deps, w.teacher, w.course.id, {
      coverId: first.coverId,
      mimeType: "image/png",
    });
    expect(saved.coverVersion).toBe(first.coverId);

    // Too big after all: deleted and refused.
    const big = await initCoverUpload(deps, w.teacher, w.course.id, {
      mimeType: "image/jpeg",
      sizeBytes: 10,
    });
    const bigKey = `courses/${w.course.id}/cover/${big.coverId}.jpg`;
    storage.sizes.set(bigKey, COVER_MAX_BYTES + 1);
    await expect(
      completeCoverUpload(deps, w.teacher, w.course.id, { coverId: big.coverId, mimeType: "image/jpeg" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(storage.deleted).toContain(bigKey);

    // A replacement deletes the old object.
    const second = await initCoverUpload(deps, w.teacher, w.course.id, {
      mimeType: "image/webp",
      sizeBytes: 10,
    });
    storage.sizes.set(`courses/${w.course.id}/cover/${second.coverId}.webp`, 4000);
    await completeCoverUpload(deps, w.teacher, w.course.id, {
      coverId: second.coverId,
      mimeType: "image/webp",
    });
    expect(storage.deleted).toContain(firstKey);

    // Draft course: only staff see the cover. Published: any signed-in user.
    await expect(coverUrl(deps, w.outsider, w.course.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await coverUrl(deps, w.teacher, w.course.id)).toContain(second.coverId);
    await db.course.update({ where: { id: w.course.id }, data: { publishedAt: new Date() } });
    expect(await coverUrl(deps, w.outsider, w.course.id)).toContain(second.coverId);

    // The catalog search finds the course by title or teacher name, with its cover version.
    const hit = (await listCatalog(deps, w.outsider, { q: w.course.title })).find(
      (c) => c.id === w.course.id,
    );
    expect(hit).toMatchObject({ coverVersion: second.coverId, state: "none" });
    expect(
      (await listCatalog(deps, w.outsider, { q: "no course is called this" })).some(
        (c) => c.id === w.course.id,
      ),
    ).toBe(false);
    expect(
      (await listCatalog(deps, w.student, { q: w.course.title })).some((c) => c.id === w.course.id),
    ).toBe(false); // already enrolled

    await removeCover(deps, w.teacher, w.course.id);
    await expect(coverUrl(deps, w.teacher, w.course.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.auditLog.count({ where: { action: "course.cover", targetId: w.course.id } })).toBe(3);
  });
});
