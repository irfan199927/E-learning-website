import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { requirePageActor } from "@/lib/session";
import { CreateCourseForm } from "./create-course-form";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requirePageActor(["ADMIN", "TEACHER"]);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/courses" className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg">
        <Icon name="chevronLeft" size={16} />
        Courses
      </Link>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">New course</h1>
        <p className="mt-1 text-muted">
          Students see it in Find a course and ask to join. You approve each request.
        </p>
      </header>
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <CreateCourseForm />
      </div>
    </div>
  );
}
