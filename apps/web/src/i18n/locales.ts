/**
 * Interface languages. Browser-safe (the language picker imports it). The choice is kept in a cookie, like the
 * theme, so the server renders the right language with no flash; without one, the browser's Accept-Language
 * decides. URLs carry no locale prefix: every page has one address in every language.
 */
export const LOCALES = ["en", "hi", "mr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

/** Each language in its own script, so people find theirs. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", hi: "हिन्दी", mr: "मराठी" };

export function parseLocale(value: string | undefined | null): Locale | null {
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : null;
}

/** The first supported language in an Accept-Language header, by quality (`hi-IN,hi;q=0.9,en;q=0.8`). */
export function negotiateLocale(header: string | null | undefined): Locale {
  const ranked = (header ?? "")
    .split(",")
    .map((part, i) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = Number(
        params
          .find((p) => p.trim().startsWith("q="))
          ?.trim()
          .slice(2) ?? 1,
      );
      return { lang: tag.toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0, i };
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { lang } of ranked) {
    const locale = parseLocale(lang);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

/** BCP 47 tag for Intl date and number formatting (Indian conventions in every language). */
export const intlLocale = (locale: Locale) => `${locale}-IN`;
