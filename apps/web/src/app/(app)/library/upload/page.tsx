import type { Metadata } from "next";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getLessonForEditing } from "@/server/services/course-content";
import { listManageableCourses } from "@/server/services/courses";
import { VideoUploader } from "./video-uploader";

export const metadata: Metadata = { title: "Upload video" };

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
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {replacing ? `Replace the video in “${replacing.title}”` : "Upload a video"}
        </h1>
        <p className="mt-1 text-muted">
          MP4, WebM or MOV up to {maxGb} GB. Uploads resume if your connection drops.
        </p>
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
