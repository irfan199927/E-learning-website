/**
 * Learner progress read models: "My courses" cards, the student overview (resume card,
 * today's watch time, streak, monthly activity) and a course's lesson list.
 *
 * Until lessons CRUD exists, a course's lessons are its READY videos in upload order.
 * Watch time comes from VideoProgress (per video) and LearningDay (per local day).
 */
import {
  courseProgressState,
  dateToDayKey,
  dayKeyToDate,
  Errors,
  learningStreak,
  localDayKey,
  monthGrid,
  percent,
  shiftMonth,
  type CourseProgressState,
} from "@elearner/core";
import { VideoStatus } from "@elearner/db";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess, visibleCoursesWhere } from "../policies";

export interface CourseCard {
  id: string;
  title: string;
  color: string;
  grade: string | null;
  teacherName: string;
  studentCount: number;
  lessonCount: number;
  completedCount: number;
  percent: number;
  state: CourseProgressState;
  /** Lesson to open from the card: the one in progress, else the first not yet completed. */
  next: { videoId: string; title: string; resume: boolean } | null;
  lastActivityAt: Date | null;
}

export async function listMyCourses(deps: Deps, actor: Actor): Promise<CourseCard[]> {
  if (actor.role === "PARENT") return []; // parents see schedules, not lessons
  const courses = await deps.db.course.findMany({
    where: visibleCoursesWhere(actor),
    select: {
      id: true,
      title: true,
      color: true,
      grade: true,
      teacher: { select: { name: true } },
      _count: { select: { enrollments: { where: { revokedAt: null } } } },
      videos: {
        where: { status: VideoStatus.READY },
        select: { id: true, title: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { title: "asc" },
    take: 200,
  });
  const progress = await deps.db.videoProgress.findMany({
    where: {
      userId: actor.id,
      video: { courseId: { in: courses.map((c) => c.id) }, status: VideoStatus.READY },
    },
    select: { videoId: true, completed: true, updatedAt: true },
  });
  const byVideo = new Map(progress.map((p) => [p.videoId, p]));

  return courses.map((c) => {
    const rows = c.videos.map((v) => ({ ...v, p: byVideo.get(v.id) }));
    const completedCount = rows.filter((r) => r.p?.completed).length;
    const started = rows.filter((r) => r.p).length;
    const inProgress = rows
      .filter((r) => r.p && !r.p.completed)
      .sort((a, b) => b.p!.updatedAt.getTime() - a.p!.updatedAt.getTime())[0];
    const firstOpen = rows.find((r) => !r.p?.completed);
    const nextRow = inProgress ?? firstOpen;
    const last = rows.reduce<Date | null>(
      (acc, r) => (r.p && (!acc || r.p.updatedAt > acc) ? r.p.updatedAt : acc),
      null,
    );
    return {
      id: c.id,
      title: c.title,
      color: c.color,
      grade: c.grade,
      teacherName: c.teacher.name,
      studentCount: c._count.enrollments,
      lessonCount: rows.length,
      completedCount,
      percent: percent(completedCount, rows.length),
      state: courseProgressState(rows.length, completedCount, started),
      next: nextRow ? { videoId: nextRow.id, title: nextRow.title, resume: !!inProgress } : null,
      lastActivityAt: last,
    };
  });
}

export interface MonthActivity {
  ym: string;
  label: string;
  prev: string | null;
  next: string | null;
  weeks: ({ key: string; day: number; seconds: number; isToday: boolean; isFuture: boolean } | null)[][];
  activeDays: number;
}

export interface LearnerOverview {
  today: string;
  todaySeconds: number;
  streak: number;
  resume: CourseCard | null;
  coursesInProgress: number;
  coursesCompleted: number;
  lessonsCompleted: number;
  month: MonthActivity;
}

const STREAK_LOOKBACK_DAYS = 370;

/** Seconds watched per local day over the streak lookback window. */
async function recentActivity(deps: Deps, actor: Actor, today: string): Promise<Map<string, number>> {
  const rows = await deps.db.learningDay.findMany({
    where: {
      userId: actor.id,
      day: { gte: new Date(dayKeyToDate(today).getTime() - STREAK_LOOKBACK_DAYS * 86_400_000) },
      watchedSeconds: { gt: 0 },
    },
    select: { day: true, watchedSeconds: true },
  });
  return new Map(rows.map((d) => [dateToDayKey(d.day), d.watchedSeconds]));
}

/** Current learning streak in days; null for roles that don't watch lessons as learners. */
export async function getStreak(deps: Deps, actor: Actor): Promise<number | null> {
  if (actor.role !== "STUDENT") return null;
  const today = localDayKey(deps.now(), actor.timezone);
  return learningStreak((await recentActivity(deps, actor, today)).keys(), today);
}

export async function getLearnerOverview(
  deps: Deps,
  actor: Actor,
  opts: { month?: string } = {},
): Promise<LearnerOverview> {
  if (actor.role !== "STUDENT") throw Errors.forbidden();
  const now = deps.now();
  const today = localDayKey(now, actor.timezone);
  const thisMonth = today.slice(0, 7);
  // Never show the future; malformed ?month= falls back to this month.
  const requested = opts.month ? shiftMonth(opts.month, 0) : null;
  const ym = requested && requested <= thisMonth ? requested : thisMonth;
  const monthStart = dayKeyToDate(`${ym}-01`);
  const monthEnd = dayKeyToDate(`${shiftMonth(ym, 1)}-01`);

  const [courses, recent, monthDays] = await Promise.all([
    listMyCourses(deps, actor),
    recentActivity(deps, actor, today),
    deps.db.learningDay.findMany({
      where: { userId: actor.id, day: { gte: monthStart, lt: monthEnd } },
      select: { day: true, watchedSeconds: true },
    }),
  ]);

  const inMonth = new Map(monthDays.map((d) => [dateToDayKey(d.day), d.watchedSeconds]));
  const [year, month] = ym.split("-").map(Number) as [number, number];

  const resume =
    courses
      .filter((c) => c.state !== "completed" && c.next)
      .sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0))[0] ?? null;

  return {
    today,
    todaySeconds: recent.get(today) ?? 0,
    streak: learningStreak(recent.keys(), today),
    resume,
    coursesInProgress: courses.filter((c) => c.state === "in-progress").length,
    coursesCompleted: courses.filter((c) => c.state === "completed").length,
    lessonsCompleted: courses.reduce((n, c) => n + c.completedCount, 0),
    month: {
      ym,
      label: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
        monthStart,
      ),
      prev: shiftMonth(ym, -1),
      next: ym < thisMonth ? shiftMonth(ym, 1) : null,
      weeks: monthGrid(year, month).map((w) =>
        w.map((cell) =>
          cell
            ? {
                ...cell,
                seconds: inMonth.get(cell.key) ?? 0,
                isToday: cell.key === today,
                isFuture: cell.key > today,
              }
            : null,
        ),
      ),
      activeDays: [...inMonth.values()].filter((s) => s > 0).length,
    },
  };
}

export interface CourseLesson {
  videoId: string;
  title: string;
  status: VideoStatus;
  durationSeconds: number | null;
  completed: boolean;
  percent: number;
}

export async function getCourseDetail(deps: Deps, actor: Actor, courseId: string) {
  await assertCourseAccess(deps.db, actor, courseId, "watch");
  const course = await deps.db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      description: true,
      color: true,
      grade: true,
      teacherId: true,
      teacher: { select: { name: true } },
      _count: { select: { enrollments: { where: { revokedAt: null } } } },
    },
  });
  if (!course) throw Errors.notFound("Course");
  const canManage = actor.role === "ADMIN" || course.teacherId === actor.id;

  // Staff also see videos still processing (or failed) so they know what students can't see yet.
  const videos = await deps.db.video.findMany({
    where: {
      courseId,
      status: canManage
        ? { in: [VideoStatus.UPLOADED, VideoStatus.TRANSCODING, VideoStatus.READY, VideoStatus.FAILED] }
        : VideoStatus.READY,
    },
    select: { id: true, title: true, status: true, durationSeconds: true },
    orderBy: { createdAt: "asc" },
  });
  const progress = await deps.db.videoProgress.findMany({
    where: { userId: actor.id, videoId: { in: videos.map((v) => v.id) } },
    select: { videoId: true, completed: true, positionSeconds: true },
  });
  const byVideo = new Map(progress.map((p) => [p.videoId, p]));

  const lessons: CourseLesson[] = videos.map((v) => {
    const p = byVideo.get(v.id);
    return {
      videoId: v.id,
      title: v.title,
      status: v.status,
      durationSeconds: v.durationSeconds,
      completed: !!p?.completed,
      percent: p?.completed ? 100 : percent(p?.positionSeconds ?? 0, v.durationSeconds ?? 0),
    };
  });
  const ready = lessons.filter((l) => l.status === VideoStatus.READY);
  const completedCount = ready.filter((l) => l.completed).length;

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    color: course.color,
    grade: course.grade,
    teacherName: course.teacher.name,
    studentCount: course._count.enrollments,
    canManage,
    lessons,
    lessonCount: ready.length,
    completedCount,
    percent: percent(completedCount, ready.length),
  };
}
