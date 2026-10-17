import { formatInZone, isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseTile } from "@/components/course-tile";
import { Icon, type IconName } from "@/components/icons";
import { JoinRequestList } from "@/components/join-request-list";
import { RosterList } from "@/components/roster-list";
import { buttonClasses } from "@/components/ui/button";
import { minutes, plural } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { listCourseAssignments } from "@/server/services/assignments";
import { recentClasses } from "@/server/services/attendance";
import { listJoinRequests } from "@/server/services/join-requests";
import { listCourseQuizzes } from "@/server/services/quizzes";
import { getCourseDetail, type CourseLesson } from "@/server/services/learning";
import { listRoster } from "@/server/services/roster";

export const metadata: Metadata = { title: "Course" };

const STATUS_LABEL: Partial<Record<NonNullable<CourseLesson["video"]>["status"], string>> = {
  PENDING_UPLOAD: "Uploading",
  UPLOADED: "Queued for processing",
  TRANSCODING: "Processing",
  FAILED: "Processing failed",
};

const TYPE: Record<string, { icon: IconName; label: string }> = {
  VIDEO: { icon: "play", label: "Video" },
  NOTE: { icon: "text", label: "Reading" },
  LINK: { icon: "link", label: "Link" },
  DOCUMENT: { icon: "file", label: "Files" },
};

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const actor = await requirePageActor(["ADMIN", "TEACHER", "STUDENT"]);
  const { courseId } = await params;
  const course = await getCourseDetail(deps(), actor, courseId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  const learner = !course.canManage;
  const [requests, roster, recent] = course.canManage
    ? await Promise.all([
        listJoinRequests(deps(), actor, courseId),
        listRoster(deps(), actor, courseId),
        recentClasses(deps(), actor, courseId),
      ])
    : [[], [], null];
  const [assignments, quizzes] = await Promise.all([
    listCourseAssignments(deps(), actor, courseId),
    listCourseQuizzes(deps(), actor, courseId),
  ]);
  const day = new Intl.DateTimeFormat("en-IN", { timeZone: actor.timezone, day: "numeric", month: "short" });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Link href="/courses" className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg">
        <Icon name="chevronLeft" size={16} />
        {learner ? "My courses" : "Courses"}
      </Link>

      <header className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:flex-row">
        <CourseTile
          title={course.title}
          grade={course.grade}
          color={course.color}
          cover={{ courseId: course.id, version: course.coverVersion }}
          className="h-36 sm:w-64"
        />
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
              {(assignments.length > 0 || quizzes.length > 0) && (
                <Link
                  href={`/courses/${course.id}/grades`}
                  className="mt-3 flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
                >
                  My grades
                  <Icon name="chevronRight" size={16} />
                </Link>
              )}
            </div>
          )}
          {course.canManage && (
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <Link href={`/courses/${course.id}/edit`} className={buttonClasses("primary")}>
                <Icon name="edit" size={18} />
                Edit course
              </Link>
              <Link href={`/library/upload?course=${course.id}`} className={buttonClasses("secondary")}>
                <Icon name="upload" size={18} />
                Upload video
              </Link>
              <Link href={`/courses/${course.id}/grades`} className={buttonClasses("secondary")}>
                <Icon name="users" size={18} />
                Gradebook
              </Link>
            </div>
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

      {recent && (
        <section
          id="attendance"
          aria-labelledby="attendance-h"
          className="scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-surface p-5"
        >
          <h2 id="attendance-h" className="mb-1 font-display text-xl font-bold">
            Attendance
          </h2>
          <p className="mb-3 text-sm text-muted">
            Recent classes. Google Meet classes fill in by themselves; take attendance for the rest.
          </p>
          {recent.classes.length === 0 ? (
            <p className="text-muted">
              No classes have started yet.{" "}
              <Link href="/calendar" className="font-semibold text-primary-fg">
                Schedule one in the Calendar
              </Link>
              .
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {recent.classes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-sm text-muted">
                      {formatInZone(c.startsAt, actor.timezone)} ·{" "}
                      {c.marked === 0 ? "Not taken" : `${c.present} of ${recent.students} present`}
                    </p>
                  </div>
                  <Link
                    href={`/classes/${c.id}/attendance`}
                    className={buttonClasses(c.marked === 0 ? "primary" : "secondary")}
                    aria-label={`${c.marked === 0 ? "Take" : "Edit"} attendance for ${c.title}, ${formatInZone(c.startsAt, actor.timezone)}`}
                  >
                    {c.marked === 0 ? "Take attendance" : "Edit"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(course.canManage || assignments.length > 0) && (
        <section
          id="assignments"
          aria-labelledby="assignments-h"
          className="scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-surface p-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="assignments-h" className="font-display text-xl font-bold">
              Assignments
            </h2>
            {course.canManage && (
              <Link href={`/courses/${course.id}/assignments/new`} className={buttonClasses("secondary")}>
                <Icon name="plus" size={18} />
                New assignment
              </Link>
            )}
          </div>
          {assignments.length === 0 ? (
            <p className="text-muted">No assignments yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {assignments.map((a) => {
                const status = a.counts
                  ? `${a.counts.submitted} handed in · ${a.counts.graded} graded${a.published ? "" : " · Draft"}`
                  : a.mine?.status === "GRADED"
                    ? `Graded: ${a.mine.score}/${a.maxPoints}`
                    : a.mine
                      ? a.mine.status === "LATE"
                        ? "Handed in late"
                        : "Handed in"
                      : a.dueAt < new Date()
                        ? "Not handed in"
                        : "To do";
                return (
                  <li key={a.id}>
                    <Link
                      href={`/assignments/${a.id}`}
                      className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-canvas"
                    >
                      <Icon name="file" size={20} className="shrink-0 text-primary-fg" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold">{a.title}</span>
                        <span className="text-sm text-muted">
                          Due {formatInZone(a.dueAt, actor.timezone)} · {status}
                        </span>
                      </span>
                      <Icon name="chevronRight" size={18} className="shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {(course.canManage || quizzes.length > 0) && (
        <section
          id="quizzes"
          aria-labelledby="quizzes-h"
          className="scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-surface p-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="quizzes-h" className="font-display text-xl font-bold">
              Quizzes
            </h2>
            {course.canManage && (
              <Link href={`/courses/${course.id}/quizzes/new`} className={buttonClasses("secondary")}>
                <Icon name="plus" size={18} />
                New quiz
              </Link>
            )}
          </div>
          {quizzes.length === 0 ? (
            <p className="text-muted">No quizzes yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {quizzes.map((q) => {
                const meta = [
                  `${q.questionCount} ${q.questionCount === 1 ? "question" : "questions"}`,
                  q.timeLimitSec ? `${Math.round(q.timeLimitSec / 60)} min` : null,
                  q.dueAt ? `closes ${formatInZone(q.dueAt, actor.timezone)}` : null,
                  q.takenBy !== null ? `taken by ${q.takenBy}` : null,
                  q.mine ? (q.mine.best === null ? "Not taken" : `Best ${q.mine.best}/${q.maxPoints}`) : null,
                  q.published ? null : "Draft",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={q.id}>
                    <Link
                      href={`/quizzes/${q.id}`}
                      className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-canvas"
                    >
                      <Icon name="check" size={20} className="shrink-0 text-primary-fg" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold">{q.title}</span>
                        <span className="text-sm text-muted">{meta}</span>
                      </span>
                      <Icon name="chevronRight" size={18} className="shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section
        aria-labelledby="lessons-h"
        className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="lessons-h" className="mb-2 font-display text-xl font-bold">
          Lessons
        </h2>
        {course.modules.length === 0 ? (
          <p className="py-6 text-muted">
            {course.canManage
              ? "No lessons yet. Use Edit course to add modules and lessons; class recordings and uploaded videos are added automatically."
              : "No lessons yet. Your teacher's lessons and class recordings will appear here."}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {course.modules.map((m) => (
              <div key={m.id}>
                <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">{m.title}</h3>
                <ol className="divide-y divide-line">
                  {m.lessons.map((l) => {
                    const type = TYPE[l.type] ?? TYPE.NOTE!;
                    const meta = [
                      type.label,
                      minutes(l.video?.durationSeconds ?? null),
                      l.video ? STATUS_LABEL[l.video.status] : null,
                      l.attachmentCount ? plural(l.attachmentCount, "file") : null,
                      l.hidden ? "Hidden from students" : null,
                      learner && l.completed ? "Completed" : null,
                      learner && !l.completed && l.percent > 0 ? `${l.percent}% watched` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <li key={l.id}>
                        <Link
                          href={`/courses/${course.id}/lessons/${l.id}`}
                          className={`-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-canvas ${
                            l.number === null ? "opacity-75" : ""
                          }`}
                        >
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
                            {l.completed ? (
                              <Icon name="check" size={18} />
                            ) : l.number === null ? (
                              <Icon name={l.hidden ? "eyeOff" : "clock"} size={18} />
                            ) : (
                              l.number
                            )}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="font-semibold">{l.title}</span>
                            <span className="text-sm text-muted">{meta}</span>
                          </span>
                          <Icon name={type.icon} size={18} className="shrink-0 text-primary-fg" />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
