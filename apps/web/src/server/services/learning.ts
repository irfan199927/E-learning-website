/**
 * Learner progress read models: "My courses" cards, the student overview (resume card,
 * today's watch time, streak, monthly activity) and a course's lesson list.
 *
 * A course's lessons are its modules' lessons in order (course-content.ts edits them). Students see published
 * lessons only, and video lessons once the video is READY. A lesson is completed when its video is watched
 * (VideoProgress) or, for text, link and file lessons, when the student ticks it (LessonProgress).
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
import { LessonType, VideoStatus, type Prisma } from "@elearner/db";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess, hasCourseAccess, visibleCoursesWhere } from "../policies";

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
  /** Lesson to open from the card: the video in progress, else the first lesson not yet completed. */
  next: { lessonId: string; title: string; resume: boolean } | null;
  lastActivityAt: Date | null;
}

/** Lessons a student sees: not hidden, and for videos only once they're ready to play. */
export const visibleLessonWhere = {
  publishedAt: { not: null },
  OR: [
    { type: { in: [LessonType.NOTE, LessonType.LINK, LessonType.DOCUMENT] } },
    { type: LessonType.VIDEO, video: { status: VideoStatus.READY } },
  ],
} satisfies Prisma.LessonWhereInput;

/** Course order: module position, then lesson position (ids break ties so the order is stable). */
const lessonOrder = [
  { module: { position: "asc" } },
  { moduleId: "asc" },
  { position: "asc" },
  { id: "asc" },
] satisfies Prisma.LessonOrderByWithRelationInput[];

interface LessonState {
  completed: boolean;
  /** Video lessons: how far the student got. */
  percent: number;
  /** A video started but not finished. */
  inProgress: boolean;
  touchedAt: Date | null;
}

/** Where the actor stands on each lesson: VideoProgress for videos, LessonProgress ticks for the rest. */
async function lessonStates(
  deps: Deps,
  userId: string,
  lessons: { id: string; type: LessonType; video: { id: string; durationSeconds: number | null } | null }[],
): Promise<Map<string, LessonState>> {
  const videoIds = lessons.flatMap((l) => (l.video ? [l.video.id] : []));
  const [videos, ticks] = await Promise.all([
    videoIds.length
      ? deps.db.videoProgress.findMany({
          where: { userId, videoId: { in: videoIds } },
          select: { videoId: true, completed: true, positionSeconds: true, updatedAt: true },
        })
      : [],
    deps.db.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessons.map((l) => l.id) } },
      select: { lessonId: true, completedAt: true },
    }),
  ]);
  const byVideo = new Map(videos.map((p) => [p.videoId, p]));
  const byLesson = new Map(ticks.map((t) => [t.lessonId, t]));
  return new Map(
    lessons.map((l) => {
      if (l.type === LessonType.VIDEO && l.video) {
        const p = byVideo.get(l.video.id);
        return [
          l.id,
          {
            completed: !!p?.completed,
            percent: p?.completed ? 100 : percent(p?.positionSeconds ?? 0, l.video.durationSeconds ?? 0),
            inProgress: !!p && !p.completed,
            touchedAt: p?.updatedAt ?? null,
          },
        ];
      }
      const t = byLesson.get(l.id);
      return [
        l.id,
        { completed: !!t, percent: t ? 100 : 0, inProgress: false, touchedAt: t?.completedAt ?? null },
      ];
    }),
  );
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
    },
    orderBy: { title: "asc" },
    take: 200,
  });
  const lessons = await deps.db.lesson.findMany({
    where: { ...visibleLessonWhere, module: { courseId: { in: courses.map((c) => c.id) } } },
    select: {
      id: true,
      title: true,
      type: true,
      module: { select: { courseId: true } },
      video: { select: { id: true, durationSeconds: true } },
    },
    orderBy: lessonOrder,
  });
  const states = await lessonStates(deps, actor.id, lessons);

  return courses.map((c) => {
    const rows = lessons
      .filter((l) => l.module.courseId === c.id)
      .map((l) => ({ ...l, s: states.get(l.id)! }));
    const completedCount = rows.filter((r) => r.s.completed).length;
    const started = rows.filter((r) => r.s.touchedAt).length;
    const inProgress = rows
      .filter((r) => r.s.inProgress)
      .sort((a, b) => b.s.touchedAt!.getTime() - a.s.touchedAt!.getTime())[0];
    const nextRow = inProgress ?? rows.find((r) => !r.s.completed);
    const last = rows.reduce<Date | null>(
      (acc, r) => (r.s.touchedAt && (!acc || r.s.touchedAt > acc) ? r.s.touchedAt : acc),
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
      next: nextRow ? { lessonId: nextRow.id, title: nextRow.title, resume: !!inProgress } : null,
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
  id: string;
  title: string;
  type: LessonType;
  /** Number in the course, counting only lessons students can see (null for ones they can't). */
  number: number | null;
  /** Staff only: hidden by the teacher. */
  hidden: boolean;
  video: { status: VideoStatus; durationSeconds: number | null } | null;
  attachmentCount: number;
  completed: boolean;
  percent: number;
}

const lessonListSelect = {
  id: true,
  title: true,
  type: true,
  publishedAt: true,
  moduleId: true,
  video: { select: { id: true, status: true, durationSeconds: true } },
  _count: { select: { attachments: true } },
} satisfies Prisma.LessonSelect;

function isVisible(l: { type: LessonType; publishedAt: Date | null; video: { status: VideoStatus } | null }) {
  if (!l.publishedAt) return false;
  if (l.type === LessonType.VIDEO) return l.video?.status === VideoStatus.READY;
  return l.type === LessonType.NOTE || l.type === LessonType.LINK || l.type === LessonType.DOCUMENT;
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
      modules: { orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true, title: true } },
    },
  });
  if (!course) throw Errors.notFound("Course");
  const canManage = actor.role === "ADMIN" || course.teacherId === actor.id;

  // Staff also see hidden lessons and videos still processing, so they know what students can't see yet.
  const lessons = await deps.db.lesson.findMany({
    where: {
      module: { courseId },
      ...(canManage
        ? { NOT: { type: LessonType.VIDEO, video: { status: VideoStatus.PENDING_UPLOAD } } }
        : visibleLessonWhere),
    },
    select: lessonListSelect,
    orderBy: lessonOrder,
  });
  const states = await lessonStates(deps, actor.id, lessons);
  let n = 0;
  const rows: (CourseLesson & { moduleId: string })[] = lessons.map((l) => {
    const visible = isVisible(l);
    const s = states.get(l.id)!;
    return {
      id: l.id,
      moduleId: l.moduleId,
      title: l.title,
      type: l.type,
      number: visible ? ++n : null,
      hidden: !l.publishedAt,
      video: l.video ? { status: l.video.status, durationSeconds: l.video.durationSeconds } : null,
      attachmentCount: l._count.attachments,
      completed: s.completed,
      percent: s.percent,
    };
  });
  const visibleRows = rows.filter((r) => r.number !== null);
  const completedCount = visibleRows.filter((l) => l.completed).length;

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    color: course.color,
    grade: course.grade,
    teacherName: course.teacher.name,
    studentCount: course._count.enrollments,
    canManage,
    modules: course.modules
      .map((m) => ({ id: m.id, title: m.title, lessons: rows.filter((r) => r.moduleId === m.id) }))
      .filter((m) => m.lessons.length > 0),
    lessonCount: visibleRows.length,
    completedCount,
    percent: percent(completedCount, visibleRows.length),
  };
}

export interface LessonView {
  id: string;
  courseId: string;
  courseTitle: string;
  moduleTitle: string;
  title: string;
  type: LessonType;
  body: string | null;
  url: string | null;
  hidden: boolean;
  canManage: boolean;
  completed: boolean;
  /** Video lessons. `ready` is false while staff look at a video that's still processing. */
  video: { id: string; ready: boolean; failed: boolean } | null;
  attachments: { id: string; fileName: string; sizeBytes: number; mimeType: string }[];
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
  /** Position among the lessons students can see. */
  number: number | null;
  total: number;
}

/** One lesson for the lesson page. NOT_FOUND for students when the lesson isn't visible to them. */
export async function getLessonView(deps: Deps, actor: Actor, lessonId: string): Promise<LessonView> {
  const lesson = await deps.db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      ...lessonListSelect,
      body: true,
      url: true,
      module: { select: { title: true, courseId: true, course: { select: { title: true } } } },
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, sizeBytes: true, mimeType: true },
      },
    },
  });
  if (!lesson || actor.role === "PARENT") throw Errors.notFound("Lesson");
  const courseId = lesson.module.courseId;
  await assertCourseAccess(deps.db, actor, courseId, "watch").catch(() => {
    throw Errors.notFound("Lesson");
  });
  const canManage = await hasCourseAccess(deps.db, actor, courseId, "manage");
  if (!canManage && !isVisible(lesson)) throw Errors.notFound("Lesson");

  // Prev / next among what students can see (staff previewing a hidden lesson still get neighbours).
  const course = await deps.db.lesson.findMany({
    where: { module: { courseId }, OR: [visibleLessonWhere, { id: lesson.id }] },
    select: { id: true, title: true },
    orderBy: lessonOrder,
  });
  const i = course.findIndex((l) => l.id === lesson.id);
  const visibleBefore = course.slice(0, i).length;
  const states = await lessonStates(deps, actor.id, [lesson]);
  const visible = isVisible(lesson);

  return {
    id: lesson.id,
    courseId,
    courseTitle: lesson.module.course.title,
    moduleTitle: lesson.module.title,
    title: lesson.title,
    type: lesson.type,
    body: lesson.body,
    url: lesson.url,
    hidden: !lesson.publishedAt,
    canManage,
    completed: states.get(lesson.id)!.completed,
    video: lesson.video
      ? {
          id: lesson.video.id,
          ready: lesson.video.status === VideoStatus.READY,
          failed: lesson.video.status === VideoStatus.FAILED,
        }
      : null,
    attachments: lesson.attachments,
    prev: i > 0 ? course[i - 1]! : null,
    next: i >= 0 && i < course.length - 1 ? course[i + 1]! : null,
    number: visible ? visibleBefore + 1 : null,
    total: course.length - (visible ? 0 : 1),
  };
}

/** A student ticks a text, link or file lesson as done (or un-ticks it). Videos complete by watching. */
export async function setLessonDone(
  deps: Deps,
  actor: Actor,
  lessonId: string,
  done: boolean,
): Promise<{ completed: boolean }> {
  if (actor.role !== "STUDENT") throw Errors.forbidden("Only students track lesson progress.");
  const view = await getLessonView(deps, actor, lessonId);
  if (view.type === LessonType.VIDEO)
    throw Errors.conflict("Video lessons are marked done when you finish watching.");
  if (done) {
    await deps.db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: actor.id, lessonId } },
      create: { userId: actor.id, lessonId, completedAt: deps.now() },
      update: {},
    });
  } else {
    await deps.db.lessonProgress.deleteMany({ where: { userId: actor.id, lessonId } });
  }
  return { completed: done };
}
