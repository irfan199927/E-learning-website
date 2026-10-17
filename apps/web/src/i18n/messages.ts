import type { Messages } from "./catalog";

export type { Messages } from "./catalog";
type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

/**
 * A translation may lag behind English: any message it lacks shows in English rather than as a raw key.
 * (`messages.test.ts` fails on keys English doesn't have and on arguments English doesn't pass.)
 */
export function withFallback(
  partial: DeepPartial<Messages> | Record<string, unknown>,
  base: Messages,
): Messages {
  const merge = (
    p: Record<string, unknown> | undefined,
    b: Record<string, unknown>,
  ): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(b).map(([k, v]) => [
        k,
        typeof v === "string"
          ? typeof p?.[k] === "string" && p[k] !== ""
            ? p[k]
            : v
          : merge(p?.[k] as Record<string, unknown> | undefined, v as Record<string, unknown>),
      ]),
    );
  return merge(partial as Record<string, unknown>, base) as Messages;
}
