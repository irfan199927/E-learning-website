import { isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseTile } from "@/components/course-tile";
import { Icon } from "@/components/icons";
import { JoinRequestList } from "@/components/join-request-list";
import { RosterList } from "@/components/roster-list";
import { buttonClasses } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { listJoinRequests } from "@/server/services/join-requests";
import { getCourseDetail, type CourseLesson } from "@/server/services/learning";
import { listRoster } from "@/server/services/roster";

export const metadata: Metadata = { title: "Course" };

const STATUS_LABEL: Partial<Record<CourseLesson["status"], string>> = {
  UPLOADED: "Queued for processing",
  TRANSCODING: "Processing",
  FAILED: "Processing failed",
};

function duration(seconds: number | null): string | null {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.max(1, m)} min`;
}

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const actor = await requirePageActor(["ADMIN", "TEACHER", "STUDENT"]);
  const { courseId } = await params;
  const course = await getCourseDetail(deps(), actor, courseId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  const learner = !course.canManage;
  const [requests, roster] = course.canManage
    ? await Promise.all([listJoinRequests(deps(), actor, courseId), listRoster(deps(), actor, courseId)])
    : [[], []];
  const day = new Intl.DateTimeFormat("en-IN", { timeZone: actor.timezone, day: "numeric", month: "short" });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Link href="/courses" className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg">
        <Icon name="chevronLeft" size={16} />
        {learner ? "My courses" : "Courses"}
      </Link>

      <header className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:flex-row">
        <CourseTile title={course.title} grade={course.grade} color={course.color} className="h-36 sm:w-64" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">{course.title}</h1>
          <p className="text-muted">
            With {course.teacherName} · {plural(course.studentCount, "student")}
          </p>
          {course.description && <p>{course.description}</p>}
          {learner && (
            <div className="mt-auto pt-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">
                  {course.completedCount}/{course.lessonCount} lessons completed
                </span>
                <span className="text-muted">{course.percent}%</span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-line"
                role="progressbar"
                aria-label="Course progress"
                aria-valuenow={course.percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-success" style={{ width: `${course.percent}%` }} />
              </div>
            </div>
          )}
          {course.canManage && (
            <Link href="/library/upload" className={buttonClasses("secondary", "mt-auto w-fit")}>
              <Icon name="upload" size={18} />
              Upload video
            </Link>
          )}
        </div>
      </header>

      {course.canManage && (
        <section
          id="join-requests"
          aria-labelledby="join-h"
          className="scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-surface p-5"
        >
          <h2 id="join-h" className="mb-1 font-display text-xl font-bold">
            Join requests{requests.length > 0 && ` (${requests.length})`}
          </h2>
          <p className="mb-3 text-sm text-muted">
            Students who signed up and asked to join. Approving gives them the lessons and class invites.
          </p>
          <JoinRequestList
            requests={requests.map((r) => ({
              id: r.id,
              name: r.student.name,
              email: r.student.email,
              message: r.message,
              requestedOn: day.format(r.createdAt),
            }))}
          />
        </section>
      )}

      {course.canManage && (
        <section
          aria-labelledby="students-h"
          className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
        >
          <h2 id="students-h" className="mb-3 font-display text-xl font-bold">
            Students ({roster.length})
          </h2>
          <RosterList
            courseId={courseId}
            students={roster.map((s) => ({
              userId: s.userId,
              name: s.name,
              email: s.email,
              enrolledOn: day.format(s.enrolledAt),
            }))}
          />
        </section>
      )}

      <section
        aria-labelledby="lessons-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="lessons-h" className="mb-2 font-display text-xl font-bold">
          Lessons
        </h2>
        {course.lessons.length === 0 ? (
          <p className="py-6 text-muted">
            No lessons yet. Class recordings and uploaded videos will appear here.
          </p>
        ) : (
          <ol className="divide-y divide-line">
            {course.lessons.map((l, i) => {
              const ready = l.status === "READY";
              const meta = [duration(l.durationSeconds), STATUS_LABEL[l.status]].filter(Boolean).join(" · ");
              const body = (
                <>
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      l.completed
                        ? "bg-success text-white"
                        : l.percent > 0
                          ? "bg-primary-soft text-primary-fg-strong"
                          : "bg-canvas text-muted"
                    }`}
                    aria-hidden="true"
                  >
                    {l.completed ? <Icon name="check" size={18} /> : i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{l.title}</span>
                    <span className="text-sm text-muted">
                      {meta}
                      {learner &&
                        (l.completed ? " · Completed" : l.percent > 0 ? ` · ${l.percent}% watched` : "")}
                    </span>
                  </span>
                  {ready && <Icon name="play" size={18} className="text-primary-fg" />}
                </>
              );
              return (
                <li key={l.videoId}>
                  {ready ? (
                    <Link
                      href={`/library/${l.videoId}`}
                      className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-canvas"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 py-3 opacity-80">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
