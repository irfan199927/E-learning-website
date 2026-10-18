import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getSchoolSettings } from "@/server/services/school-settings";
import { SchoolSettingsForm } from "./settings-form";
import { PageHeader } from "@/components/page-header";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("AdminSettings"))("title") };
}

export default async function SettingsPage() {
  await requirePageActor(["ADMIN"]);
  const [settings, t] = await Promise.all([getSchoolSettings(deps()), getTranslations("AdminSettings")]);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader icon="settings" title={t("title")} intro={t("intro")} />
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
