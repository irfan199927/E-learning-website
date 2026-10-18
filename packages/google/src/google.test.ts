import { AppError } from "@elearner/core";
import { describe, expect, it, vi } from "vitest";
import { buildConnectUrl, missingScopes, TEACHER_SCOPES } from "./oauth";
import { isInvalidGrant, isRetryable, statusOf, withRetry } from "./retry";

const noSleep = () => Promise.resolve();

describe("retry policy", () => {
  it("classifies errors", () => {
    expect(isRetryable({ status: 429 })).toBe(true);
    expect(isRetryable({ response: { status: 503 } })).toBe(true);
    expect(isRetryable({ code: 403, errors: [{ reason: "userRateLimitExceeded" }] })).toBe(true);
    expect(isRetryable({ status: 403, errors: [{ reason: "forbidden" }] })).toBe(false);
    expect(isRetryable({ status: 404 })).toBe(false);
    expect(isRetryable({ code: "ECONNRESET" })).toBe(true);
    expect(statusOf({})).toBeUndefined();
    expect(isInvalidGrant({ response: { data: { error: "invalid_grant" } } })).toBe(true);
  });

  it("retries transient failures then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue("ok");
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry client errors", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 400 });
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toEqual({ status: 400 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 503 });
    await expect(withRetry(fn, { sleep: noSleep, retries: 2 })).rejects.toEqual({ status: 503 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("marks the grant revoked on invalid_grant", async () => {
    const onRevoked = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockRejectedValue(new Error("invalid_grant: Token has been expired or revoked."));
    await expect(withRetry(fn, { sleep: noSleep, onRevoked })).rejects.toBeInstanceOf(AppError);
    expect(onRevoked).toHaveBeenCalledOnce();
  });
});

describe("oauth", () => {
  const cfg = {
    clientId: "cid",
    clientSecret: "sec",
    redirectUri: "https://app/cb",
    workspaceDomain: "school.edu",
  };
  it("requests offline access with incremental scopes for the workspace domain", () => {
    const url = new URL(buildConnectUrl(cfg, "state123", "t@school.edu"));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(url.searchParams.get("hd")).toBe("school.edu");
    expect(url.searchParams.get("state")).toBe("state123");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual([...TEACHER_SCOPES]);
  });
  it("reports missing scopes", () => {
    expect(missingScopes(["https://www.googleapis.com/auth/calendar.events"])).toHaveLength(3);
    // A grant from before Meet room creation was added is incomplete: the teacher must reconnect.
    expect(
      missingScopes([
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/meetings.space.readonly",
        "https://www.googleapis.com/auth/drive.meet.readonly",
      ]),
    ).toEqual(["https://www.googleapis.com/auth/meetings.space.created"]);
    expect(missingScopes([...TEACHER_SCOPES])).toEqual([]);
  });
});
