import "server-only";
import { Errors } from "@elearner/core";
import type { Redis } from "ioredis";

export interface RateLimitRule {
  /** Logical bucket name, e.g. "upload-init". */
  bucket: string;
  limit: number;
  windowSec: number;
}

// INCR and EXPIRE in one atomic step, so concurrent requests can't slip past the limit.
const CONSUME_LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {c, ttl}`;

/** Fixed-window counter shared by every web instance. Used by our API and by Better Auth. */
export async function consume(
  redis: Redis,
  key: string,
  windowSec: number,
  max: number,
): Promise<{ allowed: boolean; retryAfter: number | null }> {
  const [count, ttl] = (await redis.eval(CONSUME_LUA, 1, `rl:${key}`, String(windowSec))) as [number, number];
  return count <= max
    ? { allowed: true, retryAfter: null }
    : { allowed: false, retryAfter: Math.max(1, ttl) };
}

export async function enforceRateLimit(redis: Redis, rule: RateLimitRule, subject: string): Promise<void> {
  const res = await consume(redis, `${rule.bucket}:${subject}`, rule.windowSec, rule.limit);
  if (!res.allowed) throw Errors.rateLimited(res.retryAfter ?? rule.windowSec);
}
