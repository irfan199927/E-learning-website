import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FormAlert } from "@/components/form";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { isGoogleConnected, listManageableCourses } from "@/server/services/courses";
import { ClassCalendar } from "./class-calendar";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Calendar"))("title") };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePageActor();
  const sp = await searchParams;
  const d = deps();
  const isTeacher = actor.role === "TEACHER";
  const [courses, googleConnected, t] = await Promise.all([
    isTeacher ? listManageableCourses(d, actor) : Promise.resolve([]),
    isTeacher ? isGoogleConnected(d, actor.id) : Promise.resolve(false),
    getTranslations("Calendar"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("title")}</h1>
      {sp.google === "connected" && <FormAlert tone="success">{t("googleConnected")}</FormAlert>}
      {sp.google === "error" && <FormAlert>{sp.message ?? t("googleError")}</FormAlert>}
      <ClassCalendar
        timeZone={actor.timezone}
        canSchedule={isTeacher}
        googleConnected={googleConnected}
        googleAvailable={!!d.config.google.clientId}
        courses={courses.map((c) => ({ id: c.id, title: c.title, students: c._count.enrollments }))}
      />
    </div>
  );
}
