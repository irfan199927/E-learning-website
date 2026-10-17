import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { en, loadTranslation, type Messages } from "./catalog";
import { LOCALE_COOKIE, negotiateLocale, parseLocale, type Locale } from "./locales";
import { withFallback } from "./messages";

const catalogs: Record<Locale, () => Promise<Messages>> = {
  en: async () => en,
  hi: async () => withFallback(await loadTranslation("hi"), en),
  mr: async () => withFallback(await loadTranslation("mr"), en),
};

/** next-intl: the language for this request (cookie, else Accept-Language) and its messages. */
export default getRequestConfig(async () => {
  const locale =
    parseLocale((await cookies()).get(LOCALE_COOKIE)?.value) ??
    negotiateLocale((await headers()).get("accept-language"));
  return { locale, messages: await catalogs[locale](), timeZone: "Asia/Kolkata" };
});
