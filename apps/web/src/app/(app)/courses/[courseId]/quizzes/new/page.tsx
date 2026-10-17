import { isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { QuizEditor } from "@/components/quiz-editor";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getCourseDetail } from "@/server/services/learning";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("WorkEditor"))("newQuiz") };
}

export default async function NewQuizPage({ params }: { params: Promise<{ courseId: string }> }) {
  const actor = await requirePageActor(["TEACHER", "ADMIN"]);
  const { courseId } = await params;
  const course = await getCourseDetail(deps(), actor, courseId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  if (!course.canManage) notFound();
  const t = await getTranslations("WorkEditor");
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href={`/courses/${courseId}#quizzes`}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        {course.title}
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("newQuiz")}</h1>
      <QuizEditor courseId={courseId} timeZone={actor.timezone} />
    </div>
  );
}
