import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/icons";
import { requirePageActor } from "@/lib/session";
import { CreateCourseForm } from "./create-course-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("CourseEditor"))("newTitle") };
}

export default async function NewCoursePage() {
  await requirePageActor(["ADMIN", "TEACHER"]);
  const t = await getTranslations("CourseEditor");
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/courses" className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg">
        <Icon name="chevronLeft" size={16} />
        {t("courses")}
      </Link>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("newTitle")}</h1>
        <p className="mt-1 text-muted">{t("newIntro")}</p>
      </header>
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <CreateCourseForm />
      </div>
    </div>
  );
}
