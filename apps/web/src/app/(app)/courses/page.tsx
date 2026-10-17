import type { Metadata } from "next";
import Link from "next/link";
import { CourseTile } from "@/components/course-tile";
import { Icon } from "@/components/icons";
import { JoinCourseButton } from "@/components/join-course-button";
import { ProgressRing } from "@/components/progress-ring";
import { buttonClasses } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { listCatalog, pendingJoinCounts, type CatalogCourse } from "@/server/services/join-requests";
import { listMyCourses, type CourseCard } from "@/server/services/learning";

export const metadata: Metadata = { title: "Courses" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "in-progress", label: "In progress" },
  { key: "completed", label: "Completed" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[]; q?: string | string[] }>;
}) {
  const actor = await requirePageActor(["ADMIN", "TEACHER", "STUDENT"]);
  const { filter: raw, q: rawQ } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 100) : "";
  const filter: FilterKey = FILTERS.some((f) => f.key === raw) ? (raw as FilterKey) : "all";
  const learner = actor.role === "STUDENT";
  const [all, catalog, pending] = await Promise.all([
    listMyCourses(deps(), actor),
    listCatalog(deps(), actor, { q }),
    pendingJoinCounts(deps(), actor),
  ]);
  const courses = learner && filter !== "all" ? all.filter((c) => c.state === filter) : all;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {learner ? "My courses" : "Courses"}
          </h1>
          <p className="mt-1 text-muted">
            {learner ? "Pick up where you left off." : "Courses you teach, with their lessons and students."}
          </p>
        </div>
        {!learner && (
          <Link href="/courses/new" className={buttonClasses("primary")}>
            <Icon name="plus" size={18} />
            New course
          </Link>
        )}
      </header>

      {learner && (
        <nav aria-label="Filter courses">
          <ul className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = f.key === filter;
              const count = f.key === "all" ? all.length : all.filter((c) => c.state === f.key).length;
              return (
                <li key={f.key}>
                  <Link
                    href={f.key === "all" ? "/courses" : `/courses?filter=${f.key}`}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex h-11 items-center gap-2 rounded-full border px-5 text-[15px] font-medium ${
                      active
                        ? "border-ink bg-ink text-surface"
                        : "border-line-strong bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    {f.label}
                    <span className="text-xs opacity-70">{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {courses.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center text-muted">
          {all.length === 0
            ? learner
              ? "You aren't in any courses yet. Ask to join one below. Your teacher approves it."
              : "You don't teach any courses yet. Create one to get started."
            : filter === "completed"
              ? "No completed courses yet. Keep going!"
              : "Nothing in progress. Start a course from the All tab."}
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {courses.map((c) => (
            <li key={c.id}>
              <CourseRow course={c} learner={learner} pendingRequests={pending.get(c.id) ?? 0} />
            </li>
          ))}
        </ul>
      )}

      {learner && (
        <section aria-labelledby="find-h" className="flex flex-col gap-4">
          <div>
            <h2 id="find-h" className="font-display text-2xl font-bold tracking-tight">
              Find a course
            </h2>
            <p className="mt-1 text-muted">Ask to join. The course opens once your teacher approves.</p>
          </div>
          <form role="search" action="/courses#find-h" className="flex flex-wrap items-end gap-2">
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-semibold">
              Search courses
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Subject, topic or teacher"
                className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] font-normal"
              />
            </label>
            <button type="submit" className={buttonClasses("secondary")}>
              Search
            </button>
            {q && (
              <Link
                href={filter === "all" ? "/courses#find-h" : `/courses?filter=${filter}#find-h`}
                className={buttonClasses("ghost")}
              >
                Clear
              </Link>
            )}
          </form>
          {catalog.length === 0 ? (
            <p className="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center text-muted">
              {q
                ? `No open courses match “${q}”.`
                : "No courses are open for you to join right now. Check back soon."}
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {catalog.map((c) => (
                <li key={c.id}>
                  <CatalogCard course={c} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function CatalogCard({ course: c }: { course: CatalogCourse }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <CourseTile
        title={c.title}
        grade={c.grade}
        color={c.color}
        cover={{ courseId: c.id, version: c.coverVersion }}
        className="h-24 w-full"
      />
      <div>
        <h3 className="text-lg font-semibold">{c.title}</h3>
        <p className="text-sm text-muted">With {c.teacherName}</p>
      </div>
      {c.description && <p className="line-clamp-3 text-sm">{c.description}</p>}
      <div className="mt-auto flex justify-end pt-1">
        <JoinCourseButton courseId={c.id} title={c.title} state={c.state} />
      </div>
    </article>
  );
}

function CourseRow({
  course: c,
  learner,
  pendingRequests,
}: {
  course: CourseCard;
  learner: boolean;
  pendingRequests: number;
}) {
  const cta = !learner
    ? { href: `/courses/${c.id}`, label: "Open course", variant: "secondary" as const }
    : c.state === "completed"
      ? { href: `/courses/${c.id}`, label: "Review course", variant: "secondary" as const }
      : c.next
        ? {
            href: `/courses/${c.id}/lessons/${c.next.lessonId}`,
            label: c.next.resume ? "Resume learning" : "Start learning",
            variant: c.next.resume ? ("primary" as const) : ("secondary" as const),
          }
        : null;

  return (
    <article className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:flex-row">
      <Link href={`/courses/${c.id}`} tabIndex={-1} aria-hidden="true" className="sm:w-56">
        <CourseTile
          title={c.title}
          grade={c.grade}
          color={c.color}
          cover={{ courseId: c.id, version: c.coverVersion }}
          className="h-32 w-full"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg">
              <Link href={`/courses/${c.id}`} className="hover:underline">
                {c.title}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-muted">
              {learner ? `With ${c.teacherName}` : `${plural(c.studentCount, "student")} enrolled`}
            </p>
            {pendingRequests > 0 && (
              <Link
                href={`/courses/${c.id}#join-requests`}
                className="mt-2 inline-flex rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary-fg"
              >
                {plural(pendingRequests, "student")} waiting to join
              </Link>
            )}
            {learner && c.next && <p className="mt-2 font-bold">Lesson: {c.next.title}</p>}
          </div>
          {learner && (
            <ProgressRing
              value={c.percent}
              size={52}
              stroke={5}
              label={`${c.completedCount} of ${c.lessonCount} lessons completed`}
            >
              {c.state === "completed" ? (
                <Icon name="check" size={18} className="text-success" />
              ) : (
                <span className="text-[11px] font-bold">{c.percent}%</span>
              )}
            </ProgressRing>
          )}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-sm text-muted">
            {learner
              ? `${c.completedCount}/${c.lessonCount} lessons completed`
              : `${plural(c.lessonCount, "lesson")} ready`}
          </p>
          {cta ? (
            <Link href={cta.href} className={buttonClasses(cta.variant, "min-w-44")}>
              {cta.label}
            </Link>
          ) : (
            <span className="text-sm text-muted">Lessons appear after the first class.</span>
          )}
        </div>
      </div>
    </article>
  );
}
