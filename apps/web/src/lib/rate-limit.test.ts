import { describe, expect, it } from "vitest";
import { consume, enforceRateLimit } from "./rate-limit";

const redisReturning = (count: number, ttl = 30) => ({ eval: async () => [count, ttl] }) as never;
const redisDown = { eval: async () => Promise.reject(new Error("ECONNREFUSED")) } as never;
const rule = { bucket: "test", limit: 5, windowSec: 60 };

describe("rate limiter", () => {
  it("allows up to the limit, then reports retry-after", async () => {
    expect(await consume(redisReturning(5), "k", 60, 5)).toEqual({ allowed: true, retryAfter: null });
    expect(await consume(redisReturning(6, 42), "k", 60, 5)).toEqual({ allowed: false, retryAfter: 42 });
    await expect(enforceRateLimit(redisReturning(6, 42), rule, "u1")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("fails open when Redis is unreachable (G1)", async () => {
    expect(await consume(redisDown, "k", 60, 5)).toEqual({ allowed: true, retryAfter: null });
    await expect(enforceRateLimit(redisDown, rule, "u1")).resolves.toBeUndefined();
  });
});
