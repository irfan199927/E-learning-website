import { Errors } from "@elearner/core";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { toErrorResponse } from "./problem";

const log = { error: vi.fn(), warn: vi.fn() };

describe("toErrorResponse", () => {
  it("maps AppError to problem+json with code and request id", async () => {
    const res = toErrorResponse(Errors.notFound("Class"), "req-1", log);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toMatchObject({
      title: "Class not found.",
      code: "NOT_FOUND",
      requestId: "req-1",
    });
  });

  it("adds Retry-After on rate limits", () => {
    const res = toErrorResponse(Errors.rateLimited(42), "r", log);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
  });

  it("returns field errors for zod validation failures", async () => {
    const err = z.object({ title: z.string().min(3, "Too short") }).safeParse({ title: "x" }).error!;
    const body = await toErrorResponse(err, "r", log).json();
    expect(body.errors).toEqual([{ path: "title", message: "Too short" }]);
  });

  it("hides internals of unexpected errors and logs them", async () => {
    const res = toErrorResponse(new Error("db password is hunter2"), "r", log);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
    expect(log.error).toHaveBeenCalled();
  });

  it("logs upstream (5xx) AppErrors as warnings", () => {
    toErrorResponse(Errors.upstream("Google", "down"), "r", log);
    expect(log.warn).toHaveBeenCalled();
  });
});
