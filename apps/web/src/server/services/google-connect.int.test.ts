import { sha256Hex, signToken } from "@elearner/core";
import { describe, expect, it } from "vitest";
import { fakeJobs, makeDeps, testDb, world } from "@/test/fakes";
import { completeConnect, handleCalendarPush, safeReturnTo, startConnect } from "./google-connect";

describe("google connect", () => {
  it("guards the post-connect redirect", () => {
    expect(safeReturnTo("/calendar?x=1")).toBe("/calendar?x=1");
    expect(safeReturnTo("//evil.com")).toBe("/calendar");
    expect(safeReturnTo("https://evil.com")).toBe("/calendar");
    expect(safeReturnTo("/\\evil.com")).toBe("/calendar");
    expect(safeReturnTo(null)).toBe("/calendar");
  });

  it("builds a consent URL only for teachers", async () => {
    const w = await world();
    const deps = makeDeps();
    expect(new URL(startConnect(deps, w.teacher, "/dashboard")).hostname).toBe("accounts.google.com");
    expect(() => startConnect(deps, w.student, null)).toThrow();
    // A server without Google credentials (LAN-only UAT) says so instead of sending teachers to a broken page.
    const noGoogle = makeDeps({
      config: { ...deps.config, google: { ...deps.config.google, clientId: "" } },
    });
    expect(() => startConnect(noGoogle, w.teacher, null)).toThrow(/isn't set up/);
  });

  it("rejects a state token minted for someone else", async () => {
    const w = await world();
    const deps = makeDeps();
    const state = signToken({ uid: w.otherTeacher.id, rt: "/" }, deps.config.authSecret, 600);
    await expect(completeConnect(deps, w.teacher, "code", state)).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("accepts only pushes with the channel's secret token", async () => {
    const w = await world();
    const jobs = fakeJobs();
    const deps = makeDeps({ jobs });
    const id = `ch-${w.teacher.id}`;
    await testDb().watchChannel.create({
      data: {
        id,
        resourceId: "r",
        kind: "calendar",
        userId: w.teacher.id,
        tokenHash: sha256Hex("s3cret"),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    expect(await handleCalendarPush(deps, { channelId: id, token: "wrong", resourceState: "exists" })).toBe(
      "ignored",
    );
    expect(await handleCalendarPush(deps, { channelId: id, token: "s3cret", resourceState: "sync" })).toBe(
      "ignored",
    );
    expect(
      await handleCalendarPush(deps, { channelId: "nope", token: "s3cret", resourceState: "exists" }),
    ).toBe("ignored");
    expect(await handleCalendarPush(deps, { channelId: id, token: "s3cret", resourceState: "exists" })).toBe(
      "queued",
    );
    expect(jobs.log).toEqual([`calsync:${w.teacher.id}`]);
  });
});
