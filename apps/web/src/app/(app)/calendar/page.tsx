import type { Metadata } from "next";
import { FormAlert } from "@/components/form";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { isGoogleConnected, listManageableCourses } from "@/server/services/courses";
import { ClassCalendar } from "./class-calendar";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePageActor();
  const sp = await searchParams;
  const d = deps();
  const isTeacher = actor.role === "TEACHER";
  const [courses, googleConnected] = await Promise.all([
    isTeacher ? listManageableCourses(d, actor) : Promise.resolve([]),
    isTeacher ? isGoogleConnected(d, actor.id) : Promise.resolve(false),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-bold tracking-tight">Calendar</h1>
      {sp.google === "connected" && (
        <FormAlert tone="success">Google connected. You can now schedule classes with Meet links.</FormAlert>
      )}
      {sp.google === "error" && <FormAlert>{sp.message ?? "Could not connect Google."}</FormAlert>}
      <ClassCalendar
        timeZone={actor.timezone}
        canSchedule={isTeacher}
        googleConnected={googleConnected}
        courses={courses.map((c) => ({ id: c.id, title: c.title, students: c._count.enrollments }))}
      />
    </div>
  );
}
