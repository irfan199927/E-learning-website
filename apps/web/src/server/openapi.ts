/**
 * The OpenAPI 3.0 description of /api/v1, served at GET /api/v1/openapi.json. Request bodies and query strings
 * come from the same zod schemas the routes validate with, so they can't drift; `openapi.test.ts` fails when a
 * route file isn't listed here. Response bodies are described loosely (`{ data }`): the services' return types
 * are the reference for those, see docs/api.md.
 */
import {
  agreeRecordingSchema,
  completeAttachmentSchema,
  completeCoverSchema,
  completeQrSchema,
  completeUploadSchema,
  coursePriceSchema,
  createAssignmentSchema,
  createClassSchema,
  createCourseSchema,
  createLessonSchema,
  createModuleSchema,
  createUsersSchema,
  decideJoinRequestSchema,
  decidePaymentSchema,
  deleteAccountSchema,
  emailDigestSchema,
  gradeExcusalSchema,
  gradeSubmissionSchema,
  gradeWeightingSchema,
  initAttachmentSchema,
  initCoverSchema,
  initPaymentImageSchema,
  initSubmissionFileSchema,
  initUploadSchema,
  joinRequestSchema,
  lessonOrderSchema,
  linkChildSchema,
  listClassesQuerySchema,
  listPaymentsQuerySchema,
  listUsersQuerySchema,
  localeSchema,
  markAttendanceSchema,
  paymentSettingsSchema,
  paymentsExportQuerySchema,
  presignPartsSchema,
  rescheduleClassSchema,
  saveQuizSchema,
  schoolSettingsSchema,
  submitAssignmentSchema,
  submitPaymentSchema,
  submitQuizSchema,
  updateAssignmentSchema,
  updateCourseSchema,
  updateLessonSchema,
  updateModuleSchema,
  updateUserSchema,
  videoProgressSchema,
  type Role,
} from "@elearner/core";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
/** What a success looks like: `{ data }` JSON, nothing, a redirect, or a file. */
type Result = "json" | "empty" | "redirect" | "csv" | "ics" | "hls";

export interface Operation {
  method: Method;
  /** OpenAPI style: `/api/v1/courses/{id}`. */
  path: string;
  tag: string;
  summary: string;
  /** Who may call it; "public" needs no session. Resource checks (own course, enrolled…) apply on top. */
  roles: readonly Role[] | "any" | "public";
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  result?: Result;
}

const STAFF = ["TEACHER", "ADMIN"] as const;
const ADMIN = ["ADMIN"] as const;
const STUDENT = ["STUDENT"] as const;

export const OPERATIONS: Operation[] = [
  // Health
  { method: "GET", path: "/api/health", tag: "Health", summary: "Liveness", roles: "public" },
  {
    method: "GET",
    path: "/api/health/ready",
    tag: "Health",
    summary: "Readiness: database and Redis",
    roles: "public",
  },

  // Account
  {
    method: "POST",
    path: "/api/v1/me/deletion-request",
    tag: "Account",
    summary: "Delete my account (signs out everywhere; purged after the grace period)",
    roles: ["STUDENT", "PARENT"],
    body: deleteAccountSchema,
  },
  {
    method: "GET",
    path: "/api/v1/me/recording-consent",
    tag: "Account",
    summary: "My agreement to the class recording notice",
    roles: STUDENT,
  },
  {
    method: "POST",
    path: "/api/v1/me/recording-consent",
    tag: "Account",
    summary: "Agree to the current recording notice",
    roles: STUDENT,
    body: agreeRecordingSchema,
  },
  {
    method: "DELETE",
    path: "/api/v1/me/recording-consent",
    tag: "Account",
    summary: "Withdraw my agreement",
    roles: STUDENT,
    result: "empty",
  },
  {
    method: "PUT",
    path: "/api/v1/me/email-digest",
    tag: "Account",
    summary: "Daily email of unread notifications on or off",
    roles: "any",
    body: emailDigestSchema,
  },
  {
    method: "PUT",
    path: "/api/v1/me/locale",
    tag: "Account",
    summary: "My language for emails",
    roles: "any",
    body: localeSchema,
  },

  // Courses
  {
    method: "POST",
    path: "/api/v1/courses",
    tag: "Courses",
    summary: "Create a course",
    roles: STAFF,
    body: createCourseSchema,
  },
  {
    method: "PATCH",
    path: "/api/v1/courses/{id}",
    tag: "Courses",
    summary: "Edit a course",
    roles: STAFF,
    body: updateCourseSchema,
  },
  {
    method: "PUT",
    path: "/api/v1/courses/{id}/price",
    tag: "Courses",
    summary: "Set the price in rupees (0 = free)",
    roles: ADMIN,
    body: coursePriceSchema,
  },
  {
    method: "POST",
    path: "/api/v1/courses/{id}/cover/uploads",
    tag: "Courses",
    summary: "Presigned PUT for a cover image",
    roles: STAFF,
    body: initCoverSchema,
  },
  {
    method: "GET",
    path: "/api/v1/courses/{id}/cover",
    tag: "Courses",
    summary: "The cover image",
    roles: "any",
    result: "redirect",
  },
  {
    method: "PUT",
    path: "/api/v1/courses/{id}/cover",
    tag: "Courses",
    summary: "Record an uploaded cover",
    roles: STAFF,
    body: completeCoverSchema,
  },
  {
    method: "DELETE",
    path: "/api/v1/courses/{id}/cover",
    tag: "Courses",
    summary: "Remove the cover",
    roles: STAFF,
    result: "empty",
  },
  {
    method: "GET",
    path: "/api/v1/courses/{id}/join-requests",
    tag: "Courses",
    summary: "Pending join requests",
    roles: STAFF,
  },
  {
    method: "POST",
    path: "/api/v1/courses/{id}/join-requests",
    tag: "Courses",
    summary: "Ask to join a free course",
    roles: STUDENT,
    body: joinRequestSchema,
  },
  {
    method: "PATCH",
    path: "/api/v1/join-requests/{id}",
    tag: "Courses",
    summary: "Approve or decline a join request",
    roles: STAFF,
    body: decideJoinRequestSchema,
  },
  {
    method: "DELETE",
    path: "/api/v1/courses/{id}/students/{userId}",
    tag: "Courses",
    summary: "Remove a student from a course",
    roles: STAFF,
    result: "empty",
  },
  {
    method: "POST",
    path: "/api/v1/courses/{id}/modules",
    tag: "Courses",
    summary: "Add a module",
    roles: STAFF,
    body: createModuleSchema,
  },
  {
    method: "PATCH",
    path: "/api/v1/modules/{id}",
    tag: "Courses",
    summary: "Rename or move a module",
    roles: STAFF,
    body: updateModuleSchema,
  },
  {
    method: "DELETE",
    path: "/api/v1/modules/{id}",
    tag: "Courses",
    summary: "Delete an empty module",
    roles: STAFF,
    result: "empty",
  },
  {
    method: "POST",
    path: "/api/v1/modules/{id}/lessons",
    tag: "Courses",
    summary: "Add a lesson",
    roles: STAFF,
    body: createLessonSchema,
  },
  {
    method: "PUT",
    path: "/api/v1/modules/{id}/lesson-order",
    tag: "Courses",
    summary: "Reorder a module's lessons",
    roles: STAFF,
    body: lessonOrderSchema,
  },
  {
    method: "PATCH",
    path: "/api/v1/lessons/{id}",
    tag: "Courses",
    summary: "Edit, hide or move a lesson",
    roles: STAFF,
    body: updateLessonSchema,
  },
  {
    method: "DELETE",
    path: "/api/v1/lessons/{id}",
    tag: "Courses",
    summary: "Delete a lesson",
    roles: STAFF,
    result: "empty",
  },
  {
    method: "PUT",
    path: "/api/v1/lessons/{id}/progress",
    tag: "Courses",
    summary: "Mark a non-video lesson done",
    roles: STUDENT,
  },
  {
    method: "DELETE",
    path: "/api/v1/lessons/{id}/progress",
    tag: "Courses",
    summary: "Undo done",
    roles: STUDENT,
    result: "empty",
  },
  {
    method: "POST",
    path: "/api/v1/lessons/{id}/attachments/uploads",
    tag: "Courses",
    summary: "Presigned PUT for a lesson file",
    roles: STAFF,
    body: initAttachmentSchema,
  },
  {
    method: "POST",
    path: "/api/v1/lessons/{id}/attachments",
    tag: "Courses",
    summary: "Record an uploaded lesson file",
    roles: STAFF,
    body: completeAttachmentSchema,
  },
  {
    method: "GET",
    path: "/api/v1/attachments/{id}",
    tag: "Courses",
    summary: "Download a lesson file",
    roles: "any",
    result: "redirect",
  },
  {
    method: "DELETE",
    path: "/api/v1/attachments/{id}",
    tag: "Courses",
    summary: "Remove a lesson file",
    roles: STAFF,
    result: "empty",
  },

  // Videos
  {
    method: "POST",
    path: "/api/v1/videos/uploads",
    tag: "Videos",
    summary: "Start a multipart upload",
    roles: STAFF,
    body: initUploadSchema,
  },
  {
    method: "POST",
    path: "/api/v1/videos/uploads/{id}/parts",
    tag: "Videos",
    summary: "Presigned part URLs",
    roles: STAFF,
    body: presignPartsSchema,
  },
  {
    method: "POST",
    path: "/api/v1/videos/uploads/{id}/complete",
    tag: "Videos",
    summary: "Finish an upload (queues transcoding)",
    roles: STAFF,
    body: completeUploadSchema,
  },
  {
    method: "DELETE",
    path: "/api/v1/videos/uploads/{id}/complete",
    tag: "Videos",
    summary: "Abort an upload",
    roles: STAFF,
    result: "empty",
  },
  {
    method: "GET",
    path: "/api/v1/videos/{id}/hls/{path}",
    tag: "Videos",
    summary: "Gated HLS playlists (segments redirect to signed URLs)",
    roles: "any",
    result: "hls",
  },
  {
    method: "PUT",
    path: "/api/v1/videos/{id}/progress",
    tag: "Videos",
    summary: "Resume position and watched time",
    roles: "any",
    body: videoProgressSchema,
  },

  // Classes
  {
    method: "GET",
    path: "/api/v1/classes",
    tag: "Classes",
    summary: "My classes in a time range",
    roles: "any",
    query: listClassesQuerySchema,
  },
  {
    method: "POST",
    path: "/api/v1/classes",
    tag: "Classes",
    summary: "Schedule a class or weekly series",
    roles: ["TEACHER"],
    body: createClassSchema,
  },
  {
    method: "PATCH",
    path: "/api/v1/classes/{id}",
    tag: "Classes",
    summary: "Move one class",
    roles: STAFF,
    body: rescheduleClassSchema,
  },
  {
    method: "DELETE",
    path: "/api/v1/classes/{id}",
    tag: "Classes",
    summary: "Cancel a class",
    roles: STAFF,
    result: "empty",
  },
  {
    method: "GET",
    path: "/api/v1/classes/{id}/join",
    tag: "Classes",
    summary: "Time-gated redirect to the meeting",
    roles: "any",
    result: "redirect",
  },
  {
    method: "GET",
    path: "/api/v1/classes/{id}/attendance",
    tag: "Classes",
    summary: "Attendance sheet",
    roles: STAFF,
  },
  {
    method: "PUT",
    path: "/api/v1/classes/{id}/attendance",
    tag: "Classes",
    summary: "Save attendance marks",
    roles: STAFF,
    body: markAttendanceSchema,
  },
  {
    method: "GET",
    path: "/api/v1/calendar.ics",
    tag: "Classes",
    summary: "My classes as iCalendar",
    roles: "any",
    query: listClassesQuerySchema,
    result: "ics",
  },
  {
    method: "GET",
    path: "/api/v1/google/connect",
    tag: "Classes",
    summary: "Start the Google API grant",
    roles: ["TEACHER"],
    result: "redirect",
  },
  {
    method: "GET",
    path: "/api/v1/google/callback",
    tag: "Classes",
    summary: "Google OAuth redirect target",
    roles: ["TEACHER"],
    result: "redirect",
  },
  {
    method: "POST",
    path: "/api/v1/google/webhooks/calendar",
    tag: "Classes",
    summary: "Google Calendar push notifications (channel token checked)",
    roles: "public",
    result: "empty",
  },

  // Assignments, quizzes, grades
  {
    method: "GET",
    path: "/api/v1/courses/{id}/assignments",
    tag: "Work",
    summary: "A course's assignments",
    roles: ["STUDENT", ...STAFF],
  },
  {
    method: "POST",
    path: "/api/v1/courses/{id}/assignments",
    tag: "Work",
    summary: "Create an assignment",
    roles: STAFF,
    body: createAssignmentSchema,
  },
  {
    method: "GET",
    path: "/api/v1/assignments/{id}",
    tag: "Work",
    summary: "An assignment (students: with their submission)",
    roles: ["STUDENT", ...STAFF],
  },
  {
    method: "PATCH",
    path: "/api/v1/assignments/{id}",
    tag: "Work",
    summary: "Edit or publish an assignment",
    roles: STAFF,
    body: updateAssignmentSchema,
  },
  {
    method: "DELETE",
    path: "/api/v1/assignments/{id}",
    tag: "Work",
    summary: "Delete an assignment",
    roles: STAFF,
    result: "empty",
  },
  {
    method: "POST",
    path: "/api/v1/assignments/{id}/files",
    tag: "Work",
    summary: "Presigned PUT for an answer file",
    roles: STUDENT,
    body: initSubmissionFileSchema,
  },
  {
    method: "PUT",
    path: "/api/v1/assignments/{id}/submission",
    tag: "Work",
    summary: "Hand in",
    roles: STUDENT,
    body: submitAssignmentSchema,
  },
  {
    method: "GET",
    path: "/api/v1/submissions/{id}/files/{index}",
    tag: "Work",
    summary: "Download an answer file",
    roles: "any",
    result: "redirect",
  },
  {
    method: "PATCH",
    path: "/api/v1/submissions/{id}/grade",
    tag: "Work",
    summary: "Grade a submission",
    roles: STAFF,
    body: gradeSubmissionSchema,
  },
  {
    method: "GET",
    path: "/api/v1/courses/{id}/quizzes",
    tag: "Work",
    summary: "A course's quizzes",
    roles: ["STUDENT", ...STAFF],
  },
  {
    method: "POST",
    path: "/api/v1/courses/{id}/quizzes",
    tag: "Work",
    summary: "Create a quiz",
    roles: STAFF,
    body: saveQuizSchema,
  },
  {
    method: "GET",
    path: "/api/v1/quizzes/{id}",
    tag: "Work",
    summary: "A quiz (students: without correct answers)",
    roles: ["STUDENT", ...STAFF],
  },
  {
    method: "PUT",
    path: "/api/v1/quizzes/{id}",
    tag: "Work",
    summary: "Save a quiz",
    roles: STAFF,
    body: saveQuizSchema,
  },
  {
    method: "DELETE",
    path: "/api/v1/quizzes/{id}",
    tag: "Work",
    summary: "Delete a quiz",
    roles: STAFF,
    result: "empty",
  },
  {
    method: "GET",
    path: "/api/v1/quizzes/{id}/questions",
    tag: "Work",
    summary: "Questions with correct answers",
    roles: STAFF,
  },
  {
    method: "GET",
    path: "/api/v1/quizzes/{id}/results",
    tag: "Work",
    summary: "Best score per student",
    roles: STAFF,
  },
  {
    method: "POST",
    path: "/api/v1/quizzes/{id}/attempts",
    tag: "Work",
    summary: "Start or resume an attempt",
    roles: STUDENT,
  },
  {
    method: "PUT",
    path: "/api/v1/attempts/{id}",
    tag: "Work",
    summary: "Submit answers; returns the score",
    roles: STUDENT,
    body: submitQuizSchema,
  },
  {
    method: "GET",
    path: "/api/v1/courses/{id}/gradebook",
    tag: "Work",
    summary: "Every student's marks and totals",
    roles: STAFF,
  },
  {
    method: "GET",
    path: "/api/v1/courses/{id}/gradebook/csv",
    tag: "Work",
    summary: "Gradebook as CSV (audited)",
    roles: STAFF,
    result: "csv",
  },
  {
    method: "PUT",
    path: "/api/v1/courses/{id}/gradebook/excusals",
    tag: "Work",
    summary: "Excuse or un-excuse a student from one item",
    roles: STAFF,
    body: gradeExcusalSchema,
  },
  {
    method: "PUT",
    path: "/api/v1/courses/{id}/gradebook/weighting",
    tag: "Work",
    summary: "Weigh by points or by category",
    roles: STAFF,
    body: gradeWeightingSchema,
  },
  {
    method: "GET",
    path: "/api/v1/courses/{id}/my-grades",
    tag: "Work",
    summary: "My marks and total",
    roles: STUDENT,
  },

  // Payments
  {
    method: "GET",
    path: "/api/v1/courses/{id}/payments",
    tag: "Payments",
    summary: "Where to pay, and my latest report",
    roles: STUDENT,
  },
  {
    method: "POST",
    path: "/api/v1/courses/{id}/payments",
    tag: "Payments",
    summary: "Report a UPI payment (UTR)",
    roles: STUDENT,
    body: submitPaymentSchema,
  },
  {
    method: "POST",
    path: "/api/v1/payments/proofs",
    tag: "Payments",
    summary: "Presigned PUT for a payment screenshot",
    roles: STUDENT,
    body: initPaymentImageSchema,
  },
  {
    method: "GET",
    path: "/api/v1/payment-qr",
    tag: "Payments",
    summary: "The school's UPI QR code",
    roles: "any",
    result: "redirect",
  },
  {
    method: "GET",
    path: "/api/v1/admin/payment-settings",
    tag: "Payments",
    summary: "UPI details",
    roles: ADMIN,
  },
  {
    method: "PUT",
    path: "/api/v1/admin/payment-settings",
    tag: "Payments",
    summary: "Save UPI details",
    roles: ADMIN,
    body: paymentSettingsSchema,
  },
  {
    method: "POST",
    path: "/api/v1/admin/payment-settings/qr/uploads",
    tag: "Payments",
    summary: "Presigned PUT for the QR image",
    roles: ADMIN,
    body: initPaymentImageSchema,
  },
  {
    method: "PUT",
    path: "/api/v1/admin/payment-settings/qr",
    tag: "Payments",
    summary: "Record the uploaded QR image",
    roles: ADMIN,
    body: completeQrSchema,
  },
  {
    method: "DELETE",
    path: "/api/v1/admin/payment-settings/qr",
    tag: "Payments",
    summary: "Remove the QR image",
    roles: ADMIN,
    result: "empty",
  },
  {
    method: "GET",
    path: "/api/v1/admin/payments",
    tag: "Payments",
    summary: "Reported payments",
    roles: ADMIN,
    query: listPaymentsQuerySchema,
  },
  {
    method: "GET",
    path: "/api/v1/admin/payments/csv",
    tag: "Payments",
    summary: "Payments between two dates as CSV (audited)",
    roles: ADMIN,
    query: paymentsExportQuerySchema,
    result: "csv",
  },
  {
    method: "PATCH",
    path: "/api/v1/admin/payments/{id}",
    tag: "Payments",
    summary: "Approve (enrols) or reject a payment",
    roles: ADMIN,
    body: decidePaymentSchema,
  },
  {
    method: "GET",
    path: "/api/v1/admin/payments/{id}/proof",
    tag: "Payments",
    summary: "The payment screenshot",
    roles: ADMIN,
    result: "redirect",
  },

  // People and settings
  {
    method: "GET",
    path: "/api/v1/admin/users",
    tag: "People",
    summary: "Search people",
    roles: ADMIN,
    query: listUsersQuerySchema,
  },
  {
    method: "POST",
    path: "/api/v1/admin/users",
    tag: "People",
    summary: "Add people (emails a set-password link)",
    roles: ADMIN,
    body: createUsersSchema,
  },
  {
    method: "PATCH",
    path: "/api/v1/admin/users/{id}",
    tag: "People",
    summary: "Change role, switch off or on",
    roles: ADMIN,
    body: updateUserSchema,
  },
  {
    method: "POST",
    path: "/api/v1/admin/users/{id}/invite",
    tag: "People",
    summary: "Resend the invite",
    roles: ADMIN,
  },
  {
    method: "POST",
    path: "/api/v1/admin/users/{id}/restore",
    tag: "People",
    summary: "Cancel a deletion request",
    roles: ADMIN,
  },
  {
    method: "POST",
    path: "/api/v1/admin/users/{id}/children",
    tag: "People",
    summary: "Link a parent to a student",
    roles: ADMIN,
    body: linkChildSchema,
  },
  {
    method: "DELETE",
    path: "/api/v1/admin/parent-links/{id}",
    tag: "People",
    summary: "Unlink a parent and a student",
    roles: ADMIN,
    result: "empty",
  },
  {
    method: "GET",
    path: "/api/v1/admin/settings",
    tag: "People",
    summary: "School settings",
    roles: ADMIN,
  },
  {
    method: "PUT",
    path: "/api/v1/admin/settings",
    tag: "People",
    summary: "Save school settings",
    roles: ADMIN,
    body: schoolSettingsSchema,
  },
  {
    method: "GET",
    path: "/api/v1/children",
    tag: "People",
    summary: "My linked children",
    roles: ["PARENT"],
  },
  {
    method: "GET",
    path: "/api/v1/children/{id}",
    tag: "People",
    summary: "One child's progress, grades and attendance",
    roles: ["PARENT"],
  },

  // Notifications
  {
    method: "GET",
    path: "/api/v1/notifications",
    tag: "Notifications",
    summary: "My notifications, newest first (50 per page, ?before=<id>)",
    roles: "any",
  },
  {
    method: "GET",
    path: "/api/v1/notifications/unread-count",
    tag: "Notifications",
    summary: "Unread count",
    roles: "any",
  },
  {
    method: "PATCH",
    path: "/api/v1/notifications/{id}",
    tag: "Notifications",
    summary: "Mark read; returns its link",
    roles: "any",
  },
  {
    method: "POST",
    path: "/api/v1/notifications/read-all",
    tag: "Notifications",
    summary: "Mark all read",
    roles: "any",
  },
  {
    method: "GET",
    path: "/api/v1/openapi.json",
    tag: "Health",
    summary: "This document",
    roles: "public",
  },
];

const jsonSchema = (schema: ZodTypeAny) =>
  zodToJsonSchema(schema, { target: "openApi3", $refStrategy: "none" }) as Record<string, unknown>;

/** A query schema's properties as OpenAPI query parameters. */
function queryParameters(schema: ZodTypeAny) {
  const s = jsonSchema(schema) as { properties?: Record<string, unknown>; required?: string[] };
  return Object.entries(s.properties ?? {}).map(([name, prop]) => ({
    name,
    in: "query",
    required: s.required?.includes(name) ?? false,
    schema: prop,
  }));
}

const problem = { $ref: "#/components/responses/Problem" };

function responses(op: Operation) {
  const success: Record<string, unknown> = {
    json: {
      200: {
        description: "OK",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Data" } } },
      },
    },
    empty: { 204: { description: "Done" } },
    redirect: { 302: { description: "Redirect to a short-lived signed URL or the next page" } },
    csv: { 200: { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } } },
    ics: {
      200: { description: "iCalendar", content: { "text/calendar": { schema: { type: "string" } } } },
    },
    hls: {
      200: {
        description: "HLS playlist (segments redirect)",
        content: { "application/vnd.apple.mpegurl": { schema: { type: "string" } } },
      },
    },
  }[op.result ?? "json"] as Record<string, unknown>;
  return {
    ...success,
    ...(op.body || op.query ? { 400: problem } : {}),
    ...(op.roles === "public" ? {} : { 401: problem, 403: problem, 404: problem }),
    429: problem,
  };
}

export function openApiDocument(appUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of OPERATIONS) {
    const params = [...op.path.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    (paths[op.path] ??= {})[op.method.toLowerCase()] = {
      tags: [op.tag],
      summary: op.summary,
      ...(op.roles === "public" ? { security: [] } : {}),
      "x-roles": op.roles,
      parameters: [...params, ...(op.query ? queryParameters(op.query) : [])],
      ...(op.body
        ? {
            requestBody: { required: true, content: { "application/json": { schema: jsonSchema(op.body) } } },
          }
        : {}),
      responses: responses(op),
    };
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "E-learner API",
      version: "1",
      description:
        "The REST API behind the E-learner web app. Conventions (auth, 404 for hidden resources, same-origin " +
        "writes, problem+json errors) are in docs/api.md. `x-roles` lists who may call each operation.",
    },
    servers: [{ url: appUrl }],
    security: [{ session: [] }],
    tags: [...new Set(OPERATIONS.map((o) => o.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        session: { type: "apiKey", in: "cookie", name: "better-auth.session_token" },
      },
      schemas: {
        Data: { type: "object", properties: { data: {} }, required: ["data"] },
        Problem: {
          type: "object",
          properties: {
            type: { type: "string" },
            title: { type: "string" },
            status: { type: "integer" },
            code: {
              type: "string",
              enum: [
                "VALIDATION",
                "UNAUTHENTICATED",
                "FORBIDDEN",
                "NOT_FOUND",
                "CONFLICT",
                "GOOGLE_RECONNECT_REQUIRED",
                "RATE_LIMITED",
                "UPSTREAM",
                "INTERNAL",
              ],
            },
            requestId: { type: "string" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: { path: { type: "string" }, message: { type: "string" } },
              },
            },
          },
          required: ["title", "status", "code"],
        },
      },
      responses: {
        Problem: {
          description: "Error (application/problem+json)",
          content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } },
        },
      },
    },
  };
}
