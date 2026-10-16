import { isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getLessonForEditing } from "@/server/services/course-content";
import { AttachmentManager } from "./attachment-manager";
import { LessonForm } from "./lesson-form";

export const metadata: Metadata = { title: "Edit lesson" };

const TYPE_NAME: Record<string, string> = {
  VIDEO: "Video lesson",
  NOTE: "Reading",
  LINK: "Link",
  DOCUMENT: "Files",
};

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const actor = await requirePageActor(["ADMIN", "TEACHER"]);
  const { courseId, lessonId } = await params;
  const lesson = await getLessonForEditing(deps(), actor, lessonId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  if (lesson.courseId !== courseId) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href={`/courses/${courseId}/edit`}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        Edit {lesson.courseTitle}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{TYPE_NAME[lesson.type] ?? lesson.type}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{lesson.title}</h1>
        </div>
        <Link href={`/courses/${courseId}/lessons/${lesson.id}`} className={buttonClasses("secondary")}>
          See it as a student
        </Link>
      </header>

      {lesson.video && (
        <p className="rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5 text-sm">
          Video: <span className="font-semibold">{lesson.video.title}</span>
          {lesson.video.status !== "READY" && " · still processing, students see it when it's ready"}
        </p>
      )}

      <section
        aria-labelledby="lesson-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="lesson-h" className="mb-3 font-display text-xl font-bold">
          Lesson
        </h2>
        <LessonForm
          lesson={{
            id: lesson.id,
            courseId,
            type: lesson.type,
            title: lesson.title,
            body: lesson.body,
            url: lesson.url,
            moduleId: lesson.moduleId,
            published: lesson.published,
            modules: lesson.modules,
          }}
        />
      </section>

      <section
        aria-labelledby="files-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="files-h" className="mb-3 font-display text-xl font-bold">
          Files ({lesson.attachments.length})
        </h2>
        <AttachmentManager lessonId={lesson.id} files={lesson.attachments} />
      </section>
    </div>
  );
}
