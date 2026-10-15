import { describe, expect, it } from "vitest";
import { maintenanceJob, reminderJob, reminderJobId } from "./index";

describe("job contracts", () => {
  it("builds deterministic, colon-free job ids", () => {
    const id = reminderJobId("cls_1", "15m", 1760000000000);
    expect(id).toBe("reminder_15m_cls_1_1760000000000");
    expect(id).not.toContain(":");
  });
  it("validates payloads", () => {
    expect(reminderJob.safeParse({ classSessionId: "c", kind: "15m", startsAtMs: 1 }).success).toBe(true);
    expect(reminderJob.safeParse({ classSessionId: "c", kind: "1h", startsAtMs: 1 }).success).toBe(false);
    expect(maintenanceJob.safeParse({ task: "drop-database" }).success).toBe(false);
  });
});
