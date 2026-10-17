import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getSchoolSettings } from "@/server/services/school-settings";
import { SchoolSettingsForm } from "./settings-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("AdminSettings"))("title") };
}

export default async function SettingsPage() {
  await requirePageActor(["ADMIN"]);
  const [settings, t] = await Promise.all([getSchoolSettings(deps()), getTranslations("AdminSettings")]);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("intro")}</p>
      </header>
      <section
        aria-labelledby="learning-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="learning-h" className="mb-3 font-display text-xl font-bold">
          {t("learning")}
        </h2>
        <SchoolSettingsForm dailyGoalMinutes={settings.dailyGoalMinutes} />
      </section>
    </div>
  );
}
