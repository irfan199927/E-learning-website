import { isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getLessonForEditing } from "@/server/services/course-content";
import { AttachmentManager } from "./attachment-manager";
import { LessonForm } from "./lesson-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("LessonEditor"))("title") };
}

/** Lesson types with a name (`LessonEditor.typeName`); anything else shows its raw type. */
const TYPE_NAME = ["VIDEO", "NOTE", "LINK", "DOCUMENT"] as const;
const hasTypeName = (type: string): type is (typeof TYPE_NAME)[number] =>
  (TYPE_NAME as readonly string[]).includes(type);

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
  const t = await getTranslations("LessonEditor");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href={`/courses/${courseId}/edit`}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        {t("backTo", { title: lesson.courseTitle })}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">
            {hasTypeName(lesson.type) ? t(`typeName.${lesson.type}`) : lesson.type}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{lesson.title}</h1>
        </div>
        <Link href={`/courses/${courseId}/lessons/${lesson.id}`} className={buttonClasses("secondary")}>
          {t("seeAsStudent")}
        </Link>
      </header>

      {lesson.type === "VIDEO" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5 text-sm">
          <p>
            {lesson.video
              ? t.rich(lesson.video.status === "READY" ? "video" : "videoProcessing", {
                  title: lesson.video.title,
                  b: (chunks) => <span className="font-semibold">{chunks}</span>,
                })
              : t("noVideo")}
            {lesson.replacement && (
              <span className="block text-muted">
                {t("replacement", { title: lesson.replacement.title })}
              </span>
            )}
          </p>
          <Link href={`/library/upload?replace=${lesson.id}`} className={buttonClasses("secondary")}>
            {t("replaceVideo")}
          </Link>
        </div>
      )}

      <section
        aria-labelledby="lesson-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="lesson-h" className="mb-3 font-display text-xl font-bold">
          {t("lesson")}
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
          {t("files", { count: lesson.attachments.length })}
        </h2>
        <AttachmentManager lessonId={lesson.id} files={lesson.attachments} />
      </section>
    </div>
  );
}
