import type { Locale } from "./locales";
import type { Messages } from "./messages";

// Type-checked message keys and locales for useTranslations / getTranslations.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
