import { isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { QuizEditor } from "@/components/quiz-editor";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getQuizForEditing } from "@/server/services/quizzes";

export const metadata: Metadata = { title: "Edit quiz" };

export default async function EditQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const actor = await requirePageActor(["TEACHER", "ADMIN"]);
  const { quizId } = await params;
  const quiz = await getQuizForEditing(deps(), actor, quizId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href={`/quizzes/${quiz.id}`}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        {quiz.title}
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">Edit quiz</h1>
      <QuizEditor
        courseId={quiz.courseId}
        timeZone={actor.timezone}
        initial={{ ...quiz, dueAt: quiz.dueAt?.toISOString() ?? null }}
      />
    </div>
  );
}
