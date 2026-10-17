import type en from "../../messages/en.json";

export type Messages = typeof en;
type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

/**
 * A translation may lag behind English: any message it lacks shows in English rather than as a raw key.
 * (`messages.test.ts` lists what each language is missing and fails on keys English doesn't have.)
 */
export function withFallback(partial: DeepPartial<Messages>, base: Messages): Messages {
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
