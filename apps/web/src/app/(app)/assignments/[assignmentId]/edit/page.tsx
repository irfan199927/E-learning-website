import { isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentForm } from "@/components/assignment-form";
import { Icon } from "@/components/icons";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getAssignment } from "@/server/services/assignments";
import { DeleteAssignment } from "./delete-assignment";

export const metadata: Metadata = { title: "Edit assignment" };

export default async function EditAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const actor = await requirePageActor(["TEACHER", "ADMIN"]);
  const { assignmentId } = await params;
  const view = await getAssignment(deps(), actor, assignmentId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  if (!view.canManage) notFound();
  const a = view.assignment;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href={`/assignments/${a.id}`}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        {a.title}
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">Edit assignment</h1>
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <AssignmentForm
          courseId={a.courseId}
          timeZone={actor.timezone}
          assignment={{ ...a, dueAt: a.dueAt.toISOString() }}
        />
      </section>
      <DeleteAssignment id={a.id} courseId={a.courseId} />
    </div>
  );
}
