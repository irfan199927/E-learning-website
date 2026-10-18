import { formatRupees } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CourseTile } from "@/components/course-tile";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";
import { JoinCourseButton } from "@/components/join-course-button";
import { ProgressRing } from "@/components/progress-ring";
import { buttonClasses } from "@/components/ui/button";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { listCatalog, pendingJoinCounts, type CatalogCourse } from "@/server/services/join-requests";
import { listMyCourses, type CourseCard } from "@/server/services/learning";
import { PageHeader } from "@/components/page-header";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Courses"))("title") };
}

const FILTERS = [
  { key: "all", label: "all" },
  { key: "in-progress", label: "inProgress" },
  { key: "completed", label: "completed" },
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
  const [all, catalog, pending, t] = await Promise.all([
    listMyCourses(deps(), actor),
    listCatalog(deps(), actor, { q }),
    pendingJoinCounts(deps(), actor),
    getTranslations("Courses"),
  ]);
  const courses = learner && filter !== "all" ? all.filter((c) => c.state === filter) : all;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        icon="courses"
        title={learner ? t("myCourses") : t("title")}
        intro={learner ? t("introLearner") : t("introStaff")}
      >
        {!learner && (
          <Link href="/courses/new" className={buttonClasses("primary")}>
            <Icon name="plus" size={18} />
            {t("newCourse")}
          </Link>
        )}
      </PageHeader>

      {learner && (
        <nav aria-label={t("filterLabel")}>
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
                    {t(`filters.${f.label}`)}
                    <span className="text-xs opacity-70">{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {courses.length === 0 ? (
        <EmptyState icon={filter === "completed" ? "check" : "courses"}>
          {all.length === 0
            ? learner
              ? t("emptyLearner")
              : t("emptyStaff")
            : filter === "completed"
              ? t("emptyCompleted")
              : t("emptyInProgress")}
        </EmptyState>
      ) : (
        <ul
          className={
            learner ? "stagger flex flex-col gap-5" : "stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
          }
        >
          {courses.map((c) => (
            <li key={c.id} className={learner ? undefined : "flex"}>
              {learner ? (
                <CourseRow course={c} learner={learner} pendingRequests={pending.get(c.id) ?? 0} />
              ) : (
                <StaffCourseCard course={c} pendingRequests={pending.get(c.id) ?? 0} />
              )}
            </li>
          ))}
        </ul>
      )}

      {learner && (
        <section aria-labelledby="find-h" className="flex flex-col gap-4">
          <div>
            <h2 id="find-h" className="font-display text-2xl font-bold tracking-tight">
              {t("findTitle")}
            </h2>
            <p className="mt-1 text-muted">{t("findIntro")}</p>
          </div>
          <form role="search" action="/courses#find-h" className="flex flex-wrap items-end gap-2">
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-semibold">
              {t("searchLabel")}
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder={t("searchPlaceholder")}
                className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] font-normal"
              />
            </label>
            <button type="submit" className={buttonClasses("secondary")}>
              {t("search")}
            </button>
            {q && (
              <Link
                href={filter === "all" ? "/courses#find-h" : `/courses?filter=${filter}#find-h`}
                className={buttonClasses("ghost")}
              >
                {t("clear")}
              </Link>
            )}
          </form>
          {catalog.length === 0 ? (
            <p className="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center text-muted">
              {q ? t("noMatch", { q }) : t("catalogEmpty")}
            </p>
          ) : (
            <ul className="stagger grid gap-4 sm:grid-cols-2">
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

async function CatalogCard({ course: c }: { course: CatalogCourse }) {
  const t = await getTranslations("Courses");
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
        <p className="text-sm text-muted">{t("withTeacher", { name: c.teacherName })}</p>
      </div>
      {c.description && <p className="line-clamp-3 text-sm">{c.description}</p>}
      {c.priceInPaise ? (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="font-display text-xl font-bold">{formatRupees(c.priceInPaise)}</span>
          {c.payment === "PENDING" ? (
            <span className="text-sm text-muted">{t("paymentPending")}</span>
          ) : (
            <Link href={`/courses/${c.id}/pay`} className={buttonClasses("primary")}>
              {c.payment === "REJECTED" ? t("paymentRetry") : t("payAndJoin")}
              <span className="sr-only">: {c.title}</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-auto flex justify-end pt-1">
          <JoinCourseButton courseId={c.id} title={c.title} state={c.state} />
        </div>
      )}
    </article>
  );
}

/** Staff: one card per course, the whole card opens it; a waiting-to-join chip jumps to the requests. */
async function StaffCourseCard({
  course: c,
  pendingRequests,
}: {
  course: CourseCard;
  pendingRequests: number;
}) {
  const t = await getTranslations("Courses");
  return (
    <article className="lift relative flex w-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface hover:border-primary">
      <CourseTile
        title={c.title}
        grade={c.grade}
        color={c.color}
        cover={{ courseId: c.id, version: c.coverVersion }}
        className="h-36 w-full rounded-none!"
      />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h2 className="text-lg font-semibold">
          {/* Stretched link: the card is one target; the chip below sits above it. */}
          <Link href={`/courses/${c.id}`} className="after:absolute after:inset-0 after:content-['']">
            {c.title}
          </Link>
        </h2>
        <p className="flex flex-wrap gap-x-3 text-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <Icon name="users" size={15} />
            {t("studentsEnrolled", { count: c.studentCount })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="file" size={15} />
            {t("lessonsReady", { count: c.lessonCount })}
          </span>
        </p>
        {pendingRequests > 0 && (
          <Link
            href={`/courses/${c.id}#join-requests`}
            className="relative z-10 mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-sm font-semibold text-warning hover:brightness-95"
          >
            <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
            {t("waitingToJoin", { count: pendingRequests })}
          </Link>
        )}
      </div>
    </article>
  );
}

async function CourseRow({
  course: c,
  learner,
  pendingRequests,
}: {
  course: CourseCard;
  learner: boolean;
  pendingRequests: number;
}) {
  const t = await getTranslations("Courses");
  const cta = !learner
    ? { href: `/courses/${c.id}`, label: t("openCourse"), variant: "secondary" as const }
    : c.state === "completed"
      ? { href: `/courses/${c.id}`, label: t("reviewCourse"), variant: "secondary" as const }
      : c.next
        ? {
            href: `/courses/${c.id}/lessons/${c.next.lessonId}`,
            label: c.next.resume ? t("resumeLearning") : t("startLearning"),
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
              {learner
                ? t("withTeacher", { name: c.teacherName })
                : t("studentsEnrolled", { count: c.studentCount })}
            </p>
            {pendingRequests > 0 && (
              <Link
                href={`/courses/${c.id}#join-requests`}
                className="mt-2 inline-flex rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary-fg"
              >
                {t("waitingToJoin", { count: pendingRequests })}
              </Link>
            )}
            {learner && c.next && (
              <p className="mt-2 font-bold">{t("nextLesson", { title: c.next.title })}</p>
            )}
          </div>
          {learner && (
            <ProgressRing
              value={c.percent}
              size={52}
              stroke={5}
              label={t("lessonsCompletedOf", { done: c.completedCount, total: c.lessonCount })}
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
              ? t("lessonsCompleted", { done: c.completedCount, total: c.lessonCount })
              : t("lessonsReady", { count: c.lessonCount })}
          </p>
          {cta ? (
            <Link href={cta.href} className={buttonClasses(cta.variant, "min-w-44")}>
              {cta.label}
            </Link>
          ) : (
            <span className="text-sm text-muted">{t("lessonsAfterFirstClass")}</span>
          )}
        </div>
      </div>
    </article>
  );
}
