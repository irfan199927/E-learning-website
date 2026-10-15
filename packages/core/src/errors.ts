/**
 * Typed application errors. Services throw these; the HTTP layer maps them to
 * RFC 9457 problem+json responses. Never throw raw strings or generic Errors for
 * expected failures — reserve those for bugs (which become 500s and page Sentry).
 */
export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "GOOGLE_RECONNECT_REQUIRED"
  | "UPSTREAM";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  GOOGLE_RECONNECT_REQUIRED: 409,
  UPSTREAM: 502,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

export const Errors = {
  validation: (message: string, details?: Record<string, unknown>) =>
    new AppError("VALIDATION", message, details),
  unauthenticated: () => new AppError("UNAUTHENTICATED", "Sign in to continue."),
  forbidden: (message = "You don't have access to this.") => new AppError("FORBIDDEN", message),
  notFound: (what: string) => new AppError("NOT_FOUND", `${what} not found.`),
  conflict: (message: string) => new AppError("CONFLICT", message),
  rateLimited: (retryAfterSec: number) =>
    new AppError("RATE_LIMITED", "Too many requests. Try again shortly.", { retryAfterSec }),
  googleReconnect: () =>
    new AppError(
      "GOOGLE_RECONNECT_REQUIRED",
      "Your Google connection expired. Reconnect Google to continue.",
    ),
  upstream: (service: string, message: string) => new AppError("UPSTREAM", `${service}: ${message}`),
};

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
