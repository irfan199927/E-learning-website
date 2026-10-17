import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import en from "../../messages/en.json";
import { LOCALE_COOKIE, negotiateLocale, parseLocale, type Locale } from "./locales";
import { withFallback, type Messages } from "./messages";

const catalogs: Record<Locale, () => Promise<Messages>> = {
  en: async () => en,
  hi: async () => withFallback((await import("../../messages/hi.json")).default, en),
  mr: async () => withFallback((await import("../../messages/mr.json")).default, en),
};

/** next-intl: the language for this request (cookie, else Accept-Language) and its messages. */
export default getRequestConfig(async () => {
  const locale =
    parseLocale((await cookies()).get(LOCALE_COOKIE)?.value) ??
    negotiateLocale((await headers()).get("accept-language"));
  return { locale, messages: await catalogs[locale](), timeZone: "Asia/Kolkata" };
});
