/**
 * Self-service course access. Anyone may sign up with Google (lib/auth.ts) but starts with no courses:
 * a student asks to join a published course, and its teacher (or an admin) approves, which creates the
 * Enrollment. Enrollment stays the single gate for course content (policies.ts).
 */
import { randomUUID } from "node:crypto";
import {
  assertCan,
  Errors,
  type CreateCourseInput,
  type DecideJoinRequestInput,
  type JoinRequestInput,
} from "@elearner/core";
import { JoinRequestStatus } from "@elearner/db";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";
import { assertCourseAccess } from "../policies";
import { coverVersion } from "./course-cover";
import { notifyUsers } from "./notifications";

/** How many catalog courses a page shows; search narrows longer lists. */
export const CATALOG_LIMIT = 60;

export type CatalogState = "pending" | "declined" | "none";

export interface CatalogCourse {
  id: string;
  title: string;
  grade: string | null;
  color: string;
  description: string | null;
  teacherName: string;
  state: CatalogState;
  /** Paid courses: the price, and the student's latest payment report (services/payments.ts). */
  priceInPaise: number | null;
  payment: "PENDING" | "APPROVED" | "REJECTED" | null;
  /** Uploaded cover image (a cache-busting version for /api/v1/courses/:id/cover), or null for the generated tile. */
  coverVersion: string | null;
}

/**
 * Published courses a student isn't in yet, with where they stand on each (asked, declined). `q` matches the
 * title, description or teacher's name. Alphabetical, at most CATALOG_LIMIT.
 */
export async function listCatalog(
  deps: Deps,
  actor: Actor,
  opts: { q?: string } = {},
): Promise<CatalogCourse[]> {
  if (actor.role !== "STUDENT") return [];
  const q = opts.q?.trim().slice(0, 100);
  const contains = (s: string) => ({ contains: s, mode: "insensitive" as const });
  const courses = await deps.db.course.findMany({
    where: {
      publishedAt: { not: null },
      enrollments: { none: { userId: actor.id, revokedAt: null } },
      ...(q
        ? { OR: [{ title: contains(q) }, { description: contains(q) }, { teacher: { name: contains(q) } }] }
        : {}),
    },
    select: {
      id: true,
      title: true,
      grade: true,
      color: true,
      description: true,
      coverKey: true,
      isPaid: true,
      priceInPaise: true,
      teacher: { select: { name: true } },
      joinRequests: { where: { userId: actor.id }, select: { status: true } },
      manualPayments: {
        where: { userId: actor.id },
        select: { status: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { title: "asc" },
    take: CATALOG_LIMIT,
  });
  return courses.map((c) => {
    const request = c.joinRequests[0]?.status;
    const state: CatalogState =
      request === JoinRequestStatus.PENDING
        ? "pending"
        : request === JoinRequestStatus.DECLINED
          ? "declined"
          : "none";
    return {
      id: c.id,
      title: c.title,
      grade: c.grade,
      color: c.color,
      description: c.description,
      teacherName: c.teacher.name,
      state,
      coverVersion: coverVersion(c.coverKey),
      priceInPaise: c.isPaid ? c.priceInPaise : null,
      payment: c.manualPayments[0]?.status ?? null,
    };
  });
}

/** Ask to join a course. Asking again after a decline (or after being removed) reopens the request. */
export async function requestToJoin(
  deps: Deps,
  actor: Actor,
  courseId: string,
  input: JoinRequestInput,
): Promise<{ status: "pending" }> {
  assertCan(actor.role, "course:join");
  const course = await deps.db.course.findFirst({
    where: { id: courseId, publishedAt: { not: null } },
    select: { id: true, title: true, teacherId: true, isPaid: true },
  });
  if (!course) throw Errors.notFound("Course");
  if (course.isPaid) throw Errors.conflict("This is a paid course: pay for it to join.");
  const enrolled = await deps.db.enrollment.count({ where: { courseId, userId: actor.id, revokedAt: null } });
  if (enrolled) throw Errors.conflict("You're already in this course.");

  const message = input.message || null;
  await deps.db.joinRequest.upsert({
    where: { userId_courseId: { userId: actor.id, courseId } },
    create: { userId: actor.id, courseId, message },
    update: {
      status: JoinRequestStatus.PENDING,
      message,
      createdAt: deps.now(),
      decidedAt: null,
      decidedById: null,
    },
  });
  await audit(deps.db, actor, "course.join_request", { type: "Course", id: courseId });
  await notifyUsers(deps, [course.teacherId], {
    type: "course.join.requested",
    title: `${actor.name} asked to join ${course.title}`,
    body: message ? message.slice(0, 200) : "Approve or decline on the course page.",
    link: `/courses/${courseId}#join-requests`,
  });
  return { status: "pending" };
}

export interface PendingJoinRequest {
  id: string;
  createdAt: Date;
  message: string | null;
  student: { name: string; email: string };
}

/** Pending requests for a course the actor manages, oldest first. */
export async function listJoinRequests(
  deps: Deps,
  actor: Actor,
  courseId: string,
): Promise<PendingJoinRequest[]> {
  assertCan(actor.role, "course:manage");
  await assertCourseAccess(deps.db, actor, courseId, "manage");
  return deps.db.joinRequest
    .findMany({
      where: { courseId, status: JoinRequestStatus.PENDING },
      select: { id: true, createdAt: true, message: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 500,
    })
    .then((rows) => rows.map(({ user, ...r }) => ({ ...r, student: user })));
}

/** Number of pending requests per course the actor manages (for badges). */
export async function pendingJoinCounts(deps: Deps, actor: Actor): Promise<Map<string, number>> {
  if (actor.role !== "TEACHER" && actor.role !== "ADMIN") return new Map();
  const rows = await deps.db.joinRequest.groupBy({
    by: ["courseId"],
    where: {
      status: JoinRequestStatus.PENDING,
      ...(actor.role === "TEACHER" ? { course: { teacherId: actor.id } } : {}),
    },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.courseId, r._count._all]));
}

/** Approve (enrol the student) or decline a pending request. */
export async function decideJoinRequest(
  deps: Deps,
  actor: Actor,
  requestId: string,
  input: DecideJoinRequestInput,
): Promise<{ status: "approved" | "declined" }> {
  assertCan(actor.role, "course:manage");
  const request = await deps.db.joinRequest.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, courseId: true, status: true, course: { select: { title: true } } },
  });
  if (!request) throw Errors.notFound("Join request");
  // NOT_FOUND, not FORBIDDEN, for courses the actor doesn't manage: no id leaks.
  await assertCourseAccess(deps.db, actor, request.courseId, "manage").catch(() => {
    throw Errors.notFound("Join request");
  });
  if (request.status !== JoinRequestStatus.PENDING)
    throw Errors.conflict("This request was already answered.");

  const approve = input.decision === "approve";
  const now = deps.now();
  await deps.db.$transaction([
    deps.db.joinRequest.update({
      where: { id: request.id },
      data: {
        status: approve ? JoinRequestStatus.APPROVED : JoinRequestStatus.DECLINED,
        decidedAt: now,
        decidedById: actor.id,
      },
    }),
    ...(approve
      ? [
          deps.db.enrollment.upsert({
            where: { userId_courseId: { userId: request.userId, courseId: request.courseId } },
            create: { userId: request.userId, courseId: request.courseId, enrolledAt: now },
            update: { revokedAt: null, enrolledAt: now },
          }),
        ]
      : []),
    deps.db.notification.create({
      data: {
        userId: request.userId,
        channel: "IN_APP",
        type: approve ? "course.join.approved" : "course.join.declined",
        title: approve
          ? `You're in: ${request.course.title}`
          : `Your request to join ${request.course.title} was declined`,
        body: approve
          ? "Your teacher approved your request."
          : "Ask your teacher if you think this is a mistake.",
        link: approve ? `/courses/${request.courseId}` : "/courses",
      },
    }),
  ]);
  await audit(deps.db, actor, approve ? "enrollment.approve" : "enrollment.decline", {
    type: "JoinRequest",
    id: request.id,
  });
  return { status: approve ? "approved" : "declined" };
}

/** A teacher creates a course. It is published at once so students can ask to join it. */
export async function createCourse(
  deps: Deps,
  actor: Actor,
  input: CreateCourseInput,
): Promise<{ id: string }> {
  assertCan(actor.role, "course:manage");
  const base = input.title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const course = await deps.db.course.create({
    data: {
      title: input.title,
      grade: input.grade || null,
      description: input.description || null,
      slug: `${base || "course"}-${randomUUID().slice(0, 6)}`,
      teacherId: actor.id,
      publishedAt: deps.now(),
    },
    select: { id: true },
  });
  await audit(deps.db, actor, "course.create", { type: "Course", id: course.id });
  return course;
}
