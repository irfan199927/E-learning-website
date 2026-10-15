/** RFC 9457 problem+json responses. Kept dependency-light so it is unit-testable. */
import { isAppError } from "@elearner/core";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

interface Log {
  error(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
}

export function problem(
  status: number,
  title: string,
  extra: Record<string, unknown> = {},
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { type: "about:blank", title, status, ...extra },
    { status, headers: { "content-type": "application/problem+json", ...headers } },
  );
}

export function toErrorResponse(err: unknown, requestId: string, log: Log): Response {
  if (err instanceof ZodError) {
    return problem(400, "Some fields need attention.", {
      code: "VALIDATION",
      requestId,
      errors: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (isAppError(err)) {
    if (err.status >= 500) log.warn({ err, requestId }, "upstream failure");
    const retry =
      err.code === "RATE_LIMITED" ? { "retry-after": String(err.details?.retryAfterSec ?? 60) } : undefined;
    return problem(
      err.status,
      err.message,
      { code: err.code, requestId, ...(err.details ? { details: err.details } : {}) },
      retry,
    );
  }
  log.error({ err, requestId }, "unhandled error");
  return problem(500, "Something went wrong on our side. Please try again.", { code: "INTERNAL", requestId });
}
