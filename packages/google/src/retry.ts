/**
 * Retry policy for Google API calls (docs/google-setup.md#quotas).
 * Retries: 429, 5xx, and 403 with a rate-limit reason. Everything else fails fast.
 * `invalid_grant` means the teacher revoked access or the token expired → reconnect required.
 */
import { Errors } from "@elearner/core";

interface GoogleLikeError {
  status?: number;
  code?: number | string;
  response?: {
    status?: number;
    data?: { error?: string | { message?: string; errors?: { reason?: string }[] } };
  };
  errors?: { reason?: string }[];
  message?: string;
}

const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"]);

export function statusOf(err: unknown): number | undefined {
  const e = err as GoogleLikeError;
  if (typeof e?.status === "number") return e.status;
  if (typeof e?.response?.status === "number") return e.response.status;
  if (typeof e?.code === "number") return e.code;
  return undefined;
}

function reasons(err: unknown): string[] {
  const e = err as GoogleLikeError;
  const data = e?.response?.data?.error;
  const nested = typeof data === "object" && data ? (data.errors ?? []) : [];
  return [...(e?.errors ?? []), ...nested].map((x) => x.reason ?? "").filter(Boolean);
}

export function isInvalidGrant(err: unknown): boolean {
  const e = err as GoogleLikeError;
  return e?.response?.data?.error === "invalid_grant" || /invalid_grant/.test(e?.message ?? "");
}

export function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  if (status === 403) return reasons(err).some((r) => RATE_LIMIT_REASONS.has(r));
  const code = (err as GoogleLikeError)?.code;
  return code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EAI_AGAIN";
}

export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRevoked?: () => Promise<void>;
}

/** Exponential backoff with full jitter. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 5, baseMs = 500, maxMs = 16_000, random = Math.random } = opts;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isInvalidGrant(err)) {
        await opts.onRevoked?.();
        throw Errors.googleReconnect();
      }
      if (attempt >= retries || !isRetryable(err)) throw err;
      await sleep(Math.floor(random() * Math.min(maxMs, baseMs * 2 ** attempt)));
    }
  }
}
