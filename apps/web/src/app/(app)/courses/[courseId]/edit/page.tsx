import { isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getCourseOutline } from "@/server/services/course-content";
import { CourseDetailsForm } from "./course-details-form";
import { CoverEditor } from "./cover-editor";
import { PriceEditor } from "./price-editor";
import { OutlineEditor } from "./outline-editor";

export const metadata: Metadata = { title: "Edit course" };

export default async function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const actor = await requirePageActor(["ADMIN", "TEACHER"]);
  const { courseId } = await params;
  const outline = await getCourseOutline(deps(), actor, courseId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link
        href={`/courses/${courseId}`}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        Back to the course
      </Link>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Edit {outline.course.title}</h1>
        <p className="mt-1 text-muted">
          Organise lessons into modules. Students see them in this order; hidden lessons stay invisible to
          them.
        </p>
      </header>

      <section aria-labelledby="content-h" className="flex flex-col gap-4">
        <h2 id="content-h" className="font-display text-xl font-bold">
          Modules and lessons
        </h2>
        <OutlineEditor
          courseId={courseId}
          modules={outline.modules.map((m) => ({
            id: m.id,
            title: m.title,
            lessons: m.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              type: l.type,
              published: l.published,
              videoStatus: l.video && l.video.status !== "READY" ? l.video.status : null,
              attachmentCount: l.attachmentCount,
            })),
          }))}
          looseVideos={outline.looseVideos}
        />
      </section>

      <section
        aria-labelledby="details-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="details-h" className="mb-3 font-display text-xl font-bold">
          Course details
        </h2>
        <CourseDetailsForm course={outline.course} />
      </section>

      {actor.role === "ADMIN" && (
        <section
          aria-labelledby="price-h"
          className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
        >
          <h2 id="price-h" className="mb-1 font-display text-xl font-bold">
            Price
          </h2>
          <p className="mb-3 text-sm text-muted">
            Free courses: students ask to join and the teacher approves. Paid courses: students pay by UPI and
            you approve the payment on the Payments page.
          </p>
          <PriceEditor courseId={courseId} priceInPaise={outline.course.priceInPaise} />
        </section>
      )}

      <section
        aria-labelledby="cover-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="cover-h" className="mb-3 font-display text-xl font-bold">
          Cover image
        </h2>
        <CoverEditor course={outline.course} />
      </section>
    </div>
  );
}
