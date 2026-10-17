import { describe, expect, it } from "vitest";
import { erasureDate } from "./account";
import { deleteAccountSchema } from "./schemas";

describe("account deletion", () => {
  it("purges 30 days after the request and needs DELETE typed", () => {
    expect(erasureDate(new Date("2026-10-17T10:00:00Z")).toISOString()).toBe("2026-11-16T10:00:00.000Z");
    expect(deleteAccountSchema.safeParse({ confirm: "DELETE" }).success).toBe(true);
    const bad = deleteAccountSchema.safeParse({ confirm: "delete" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe("Type DELETE to confirm.");
  });
});
