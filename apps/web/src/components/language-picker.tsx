"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, parseLocale, type Locale } from "@/i18n/locales";

/**
 * Interface language. Saved in a cookie that src/i18n/request.ts reads, then the page re-renders on the server
 * in the new language. `compact` hides the visible label (the sign-in page's corner). Signed in (`saveToAccount`),
 * the choice is also stored on the account so emails use it.
 */
export function LanguagePicker({
  current,
  compact = false,
  saveToAccount = false,
}: {
  current: Locale;
  compact?: boolean;
  saveToAccount?: boolean;
}) {
  const t = useTranslations("Language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = useId();

  function choose(value: string) {
    const locale = parseLocale(value);
    if (!locale) return;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    startTransition(async () => {
      // Best effort: the page language already follows the cookie.
      if (saveToAccount)
        await fetch("/api/v1/me/locale", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ locale }),
          credentials: "same-origin",
        }).catch(() => undefined);
      router.refresh();
    });
  }

  return (
    <div className={compact ? "flex items-center" : "flex flex-col gap-1.5"}>
      <label htmlFor={id} className={compact ? "sr-only" : "text-sm font-semibold"}>
        {t("label")}
      </label>
      <select
        id={id}
        value={current}
        onChange={(e) => choose(e.target.value)}
        disabled={pending}
        className={`rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] ${
          compact ? "h-11 text-sm" : "h-11 w-fit"
        }`}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
