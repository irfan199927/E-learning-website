import { describe, expect, it } from "vitest";
import { RECORDING_NOTICE_VERSION, recordingConsentStatus } from "./recording";

describe("recording consent", () => {
  it("reads the newest consent row", () => {
    expect(recordingConsentStatus(null)).toBe("none");
    expect(recordingConsentStatus({ version: RECORDING_NOTICE_VERSION, withdrawnAt: null })).toBe("agreed");
    expect(recordingConsentStatus({ version: "2020-01-01", withdrawnAt: null })).toBe("outdated");
    expect(recordingConsentStatus({ version: RECORDING_NOTICE_VERSION, withdrawnAt: new Date() })).toBe(
      "withdrawn",
    );
  });
});
