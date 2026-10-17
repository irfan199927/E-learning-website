import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getLessonForEditing } from "@/server/services/course-content";
import { listManageableCourses } from "@/server/services/courses";
import { VideoUploader } from "./video-uploader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Upload"))("title") };
}

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; module?: string; replace?: string }>;
}) {
  const { course, module, replace } = await searchParams;
  const actor = await requirePageActor(["TEACHER", "ADMIN"]);
  const courses = await listManageableCourses(deps(), actor);
  // "Replace video" on a video lesson: upload into that lesson's course, swapped in once processed.
  const lesson = replace ? await getLessonForEditing(deps(), actor, replace).catch(() => null) : null;
  const replacing = lesson?.type === "VIDEO" ? lesson : null;
  const maxGb = Math.round(deps().config.maxUploadBytes / 1024 ** 3);
  const t = await getTranslations("Upload");
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {replacing ? t("replaceHeading", { title: replacing.title }) : t("heading")}
        </h1>
        <p className="mt-1 text-muted">{t("intro", { gb: maxGb })}</p>
      </header>
      <VideoUploader
        courses={courses.map((c) => ({ id: c.id, title: c.title, modules: c.modules }))}
        initialCourseId={courses.some((c) => c.id === course) ? course : undefined}
        initialModuleId={module}
        replace={
          replacing
            ? { lessonId: replacing.id, courseId: replacing.courseId, title: replacing.title }
            : undefined
        }
      />
    </div>
  );
}
