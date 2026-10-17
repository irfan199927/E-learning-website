import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguagePicker } from "@/components/language-picker";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Shell");
  const locale = await getLocale();
  return (
    <main className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguagePicker current={locale} compact />
        <ThemeToggle className="text-muted hover:text-ink" label={t("darkMode")} title={t("darkModeTitle")} />
      </div>
      <div className="w-full max-w-[420px] rounded-[var(--radius-card)] border border-line bg-surface p-8 shadow-sm">
        <Link href="/" className="mb-6 flex w-fit items-center gap-2.5" aria-label={t("home")}>
          <span className="grid size-9 place-items-center rounded-[9px] bg-primary" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 9l10-5 10 5-10 5z" />
              <path d="M6 11v5c3 2 9 2 12 0v-5" />
            </svg>
          </span>
          <span className="font-display text-[22px] font-bold">E-learner</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
