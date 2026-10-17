import { formatInZone, RECORDING_NOTICE } from "@elearner/core";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getRecordingConsent } from "@/server/services/recording-consent";
import { ConsentButtons } from "./consent-buttons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("RecordingConsent"))("title") };
}

export default async function RecordingConsentPage() {
  const actor = await requirePageActor(["STUDENT"]);
  const [consent, t, locale] = await Promise.all([
    getRecordingConsent(deps(), actor),
    getTranslations("RecordingConsent"),
    getLocale(),
  ]);
  // "agreed" shows the date instead; the other answers have a message each.
  const message = consent.status === "agreed" ? null : t(consent.status);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <p className="text-sm font-semibold text-muted">{t("title")}</p>
        {/* The notice itself (RECORDING_NOTICE, core) stays in English until a translation is legally reviewed. */}
        <h1 className="font-display text-3xl font-bold tracking-tight">{RECORDING_NOTICE.title}</h1>
      </header>
      <section
        aria-labelledby="notice-h"
        className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="notice-h" className="sr-only">
          {t("noticeHeading")}
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {RECORDING_NOTICE.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">{t("version", { version: consent.version })}</p>
        <p className="font-semibold">
          {consent.agreedAt
            ? t("agreedOn", { date: formatInZone(consent.agreedAt, actor.timezone, intlLocale(locale)) })
            : message}
        </p>
        <ConsentButtons agreed={consent.status === "agreed"} version={consent.version} />
      </section>
    </div>
  );
}
