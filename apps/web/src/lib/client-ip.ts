import "server-only";
import { env } from "@/env";

/**
 * Client IP for rate limiting: the header named by CLIENT_IP_HEADER (set by our proxy), else the first
 * `x-forwarded-for` hop. Without a proxy that overwrites it the client can fake either, so limits that matter
 * (sign-in) are also kept per account.
 */
export function clientIp(headers: Headers): string | null {
  const name = env().CLIENT_IP_HEADER || "x-forwarded-for";
  return headers.get(name)?.split(",")[0]?.trim() || null;
}
