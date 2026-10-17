"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "./icons";
import { buttonClasses } from "./ui/button";

/** Asks a student to read the class-recording notice until they answer (not shown on the notice page itself). */
export function RecordingBanner({ outdated }: { outdated: boolean }) {
  const t = useTranslations("RecordingConsent");
  if (usePathname() === "/recording-consent") return null;
  const b = (chunks: React.ReactNode) => <b>{chunks}</b>;
  return (
    <aside
      aria-label={t("title")}
      className="mb-6 flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-line bg-primary-soft p-4"
    >
      <Icon name="video" size={24} className="shrink-0 text-primary-fg-strong" />
      <p className="min-w-48 flex-1">
        {outdated ? t.rich("bannerOutdated", { b }) : t.rich("bannerNew", { b })}
      </p>
      <Link href="/recording-consent" className={buttonClasses("primary")}>
        {t("readNotice")}
      </Link>
    </aside>
  );
}
