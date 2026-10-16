import { isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentForm } from "@/components/assignment-form";
import { Icon } from "@/components/icons";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getCourseDetail } from "@/server/services/learning";

export const metadata: Metadata = { title: "New assignment" };

export default async function NewAssignmentPage({ params }: { params: Promise<{ courseId: string }> }) {
  const actor = await requirePageActor(["TEACHER", "ADMIN"]);
  const { courseId } = await params;
  const course = await getCourseDetail(deps(), actor, courseId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  if (!course.canManage) notFound();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href={`/courses/${courseId}#assignments`}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        {course.title}
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">New assignment</h1>
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <AssignmentForm courseId={courseId} timeZone={actor.timezone} />
      </section>
    </div>
  );
}
