import type { Metadata } from "next";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getSchoolSettings } from "@/server/services/school-settings";
import { SchoolSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePageActor(["ADMIN"]);
  const settings = await getSchoolSettings(deps());
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted">
          School-wide settings. UPI details for paid courses are on the Payments page.
        </p>
      </header>
      <section
        aria-labelledby="learning-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="learning-h" className="mb-3 font-display text-xl font-bold">
          Learning
        </h2>
        <SchoolSettingsForm dailyGoalMinutes={settings.dailyGoalMinutes} />
      </section>
    </div>
  );
}
