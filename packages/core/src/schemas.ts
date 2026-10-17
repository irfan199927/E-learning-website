/**
 * Request schemas shared by API handlers (server validation) and forms (client validation).
 * One schema per use case; keep messages user-readable, they reach the UI.
 */
import { z } from "zod";
import { ROLES } from "./rbac";
import { MAX_SUBMISSION_FILES, SUBMISSION_FILE_MAX_BYTES } from "./grading";
import { WEEKDAYS } from "./rrule";
import { isValidTimeZone } from "./time";

const id = z.string().min(1).max(64);
const isoDate = z.coerce.date({ invalid_type_error: "Enter a valid date and time." });

export const MAX_CLASS_MINUTES = 240;
export const MAX_SERIES_DAYS = 200;
export const MAX_LIST_RANGE_DAYS = 62;

export const recurrenceSchema = z.object({
  freq: z.literal("WEEKLY"),
  byDay: z.array(z.enum(WEEKDAYS)).min(1, "Pick at least one day."),
  until: isoDate,
});

export const createClassSchema = z
  .object({
    courseId: id,
    title: z.string().trim().min(3, "Title is too short.").max(120),
    agenda: z.string().trim().max(2000).optional(),
    startsAt: isoDate,
    endsAt: isoDate,
    timezone: z.string().refine(isValidTimeZone, "Unknown timezone.").default("Asia/Kolkata"),
    recurrence: recurrenceSchema.optional(),
    notifyParents: z.boolean().default(true),
    /**
     * "google": a Google Calendar event with a Meet link (needs the teacher's Google connection).
     * "none": no Google. The class can have a room and/or a meeting link the teacher pastes (Zoom, Teams, Jitsi…).
     */
    meeting: z.enum(["google", "none"]).default("google"),
    meetingUrl: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .string()
        .trim()
        .url("Enter the full meeting link, starting with https://")
        .max(2000)
        .refine((u) => /^https:\/\//i.test(u), "Meeting links must start with https://")
        .optional(),
    ),
    location: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().trim().max(120, "Keep the place under 120 characters.").optional(),
    ),
  })
  .superRefine((v, ctx) => {
    const minutes = (v.endsAt.getTime() - v.startsAt.getTime()) / 60_000;
    if (minutes <= 0)
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after start time." });
    if (minutes > MAX_CLASS_MINUTES)
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: `A class can be at most ${MAX_CLASS_MINUTES / 60} hours.`,
      });
    if (v.recurrence) {
      const days = (v.recurrence.until.getTime() - v.startsAt.getTime()) / 86_400_000;
      if (days < 0)
        ctx.addIssue({
          code: "custom",
          path: ["recurrence", "until"],
          message: "Repeat-until must be after the first class.",
        });
      if (days > MAX_SERIES_DAYS)
        ctx.addIssue({
          code: "custom",
          path: ["recurrence", "until"],
          message: `A series can span at most ${MAX_SERIES_DAYS} days.`,
        });
    }
  });
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const MAX_ATTENDANCE_MARKS = 500;

export const markAttendanceSchema = z.object({
  marks: z
    .array(z.object({ userId: id, present: z.boolean() }))
    .min(1, "Mark at least one student.")
    .max(MAX_ATTENDANCE_MARKS),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const rescheduleClassSchema = z
  .object({ startsAt: isoDate, endsAt: isoDate })
  .refine((v) => v.endsAt > v.startsAt, { path: ["endsAt"], message: "End time must be after start time." });
export type RescheduleClassInput = z.infer<typeof rescheduleClassSchema>;

export const listClassesQuerySchema = z
  .object({ from: isoDate, to: isoDate, courseId: id.optional() })
  .refine((v) => v.to > v.from, { message: "`to` must be after `from`." })
  .refine((v) => (v.to.getTime() - v.from.getTime()) / 86_400_000 <= MAX_LIST_RANGE_DAYS, {
    message: `Range can be at most ${MAX_LIST_RANGE_DAYS} days.`,
  });
export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;

export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const UPLOAD_PART_BYTES = 16 * 1024 * 1024; // 16 MiB; S3 allows 5 MiB–5 GiB per part, max 10,000 parts

export const initUploadSchema = z.object({
  courseId: id,
  title: z.string().trim().min(3).max(160),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(VIDEO_MIME_TYPES, { errorMap: () => ({ message: "Upload an MP4, WebM or MOV video." }) }),
  sizeBytes: z.number().int().positive(),
  /** Module to add the video lesson to. Without one it goes into the course's "Videos" module. */
  moduleId: id.optional(),
  /** Replace the video of this VIDEO lesson instead of adding a lesson (swapped in once the new one is ready). */
  replaceLessonId: id.optional(),
});
export type InitUploadInput = z.infer<typeof initUploadSchema>;

export const presignPartsSchema = z.object({
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(100),
});

export const completeUploadSchema = z.object({
  parts: z
    .array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1).max(200) }))
    .min(1)
    .max(10_000),
});
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

export const videoProgressSchema = z.object({
  positionSeconds: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600),
  /** Seconds actually watched since the last beacon; capped to stop progress inflation. */
  watchedDeltaSeconds: z.number().int().min(0).max(120).default(0),
  completed: z.boolean().optional(),
});
export type VideoProgressInput = z.infer<typeof videoProgressSchema>;

export function partCount(sizeBytes: number, partBytes = UPLOAD_PART_BYTES): number {
  return Math.ceil(sizeBytes / partBytes);
}

export const createCourseSchema = z.object({
  title: z.string().trim().min(3, "Title is too short.").max(120),
  grade: z.string().trim().max(20).optional(),
  description: z.string().trim().max(2000).optional(),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

/** Course card colours teachers can pick from (each passes contrast with white text). */
export const COURSE_COLORS = [
  { value: "#2340D9", name: "Blue" },
  { value: "#0F7B5F", name: "Green" },
  { value: "#B4357A", name: "Pink" },
  { value: "#8A4B08", name: "Brown" },
  { value: "#5B3CC4", name: "Purple" },
  { value: "#B3261E", name: "Red" },
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

export const updateCourseSchema = z
  .object({
    title: z.string().trim().min(3, "Title is too short.").max(120).optional(),
    grade: optionalText(20),
    description: optionalText(2000),
    color: z
      .string()
      .refine((c) => COURSE_COLORS.some((x) => x.value === c), "Pick one of the colours.")
      .optional(),
    /** false hides the course from "Find a course"; students already in it keep access. */
    listed: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to change.");
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

// ── Course content: modules, lessons, attachments ──

const moveSchema = z.enum(["up", "down"]);

export const createModuleSchema = z.object({
  title: z.string().trim().min(1, "Give the module a name.").max(120),
});
export type CreateModuleInput = z.infer<typeof createModuleSchema>;

export const updateModuleSchema = z
  .object({ title: createModuleSchema.shape.title.optional(), move: moveSchema.optional() })
  .refine((v) => v.title !== undefined || v.move !== undefined, "Nothing to change.");
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;

const lessonTitle = z.string().trim().min(1, "Give the lesson a title.").max(160);
const lessonBody = z.string().trim().max(20_000, "Keep the text under 20,000 characters.");
const lessonUrl = z
  .string()
  .trim()
  .url("Enter a full web address, starting with https://")
  .max(2000)
  .refine((u) => /^https?:\/\//i.test(u), "Only http:// and https:// links work.");

/** Video lessons for new uploads are created by the upload itself; this adds an existing course video. */
export const createLessonSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("VIDEO"), title: lessonTitle, videoId: id }),
  z.object({ type: z.literal("NOTE"), title: lessonTitle, body: lessonBody.min(1, "Write something.") }),
  z.object({ type: z.literal("LINK"), title: lessonTitle, url: lessonUrl, body: lessonBody.optional() }),
  z.object({ type: z.literal("DOCUMENT"), title: lessonTitle, body: lessonBody.optional() }),
]);
export type CreateLessonInput = z.infer<typeof createLessonSchema>;

export const updateLessonSchema = z
  .object({
    title: lessonTitle.optional(),
    body: lessonBody.optional(),
    url: lessonUrl.optional(),
    moduleId: id.optional(),
    published: z.boolean().optional(),
    move: moveSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to change.");
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_LESSON = 20;
/** Files teachers can attach. Downloads are always served as attachments, never rendered inline. */
export const ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/zip",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

const attachmentFile = {
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(ATTACHMENT_MIME_TYPES, {
    errorMap: () => ({
      message: "That file type can't be attached. Use PDF, Office, text, image or zip files.",
    }),
  }),
};

export const initAttachmentSchema = z.object({
  ...attachmentFile,
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(ATTACHMENT_MAX_BYTES, `Files can be at most ${ATTACHMENT_MAX_BYTES / 1024 ** 2} MB.`),
});
export type InitAttachmentInput = z.infer<typeof initAttachmentSchema>;

export const completeAttachmentSchema = z.object({ attachmentId: z.string().uuid(), ...attachmentFile });
export type CompleteAttachmentInput = z.infer<typeof completeAttachmentSchema>;

// ── Course cover images ──

export const COVER_MAX_BYTES = 2 * 1024 * 1024;
/** Image types a cover can be, with the file extension each is stored under. */
export const COVER_MIME_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const coverMime = z.enum(Object.keys(COVER_MIME_TYPES) as [keyof typeof COVER_MIME_TYPES], {
  errorMap: () => ({ message: "Use a JPEG, PNG or WebP image." }),
});

export const initCoverSchema = z.object({
  mimeType: coverMime,
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(COVER_MAX_BYTES, `Cover images can be at most ${COVER_MAX_BYTES / 1024 ** 2} MB.`),
});
export type InitCoverInput = z.infer<typeof initCoverSchema>;

export const completeCoverSchema = z.object({ coverId: z.string().uuid(), mimeType: coverMime });
export type CompleteCoverInput = z.infer<typeof completeCoverSchema>;

export const linkChildSchema = z.object({
  studentEmail: z.string().trim().toLowerCase().email("Enter the student's email address.").max(254),
});
export type LinkChildInput = z.infer<typeof linkChildSchema>;

// ── Assignments ──

const assignmentFields = {
  title: z.string().trim().min(3, "Title is too short.").max(160),
  instructions: z.string().trim().min(1, "Tell students what to do.").max(20_000),
  dueAt: isoDate,
  maxPoints: z.coerce.number().int().min(1, "At least 1 point.").max(1000),
  allowText: z.boolean(),
  allowFile: z.boolean(),
  allowLate: z.boolean(),
  published: z.boolean(),
};

export const createAssignmentSchema = z.object(assignmentFields).refine((v) => v.allowText || v.allowFile, {
  path: ["allowText"],
  message: "Allow a text answer, files, or both.",
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const updateAssignmentSchema = z
  .object(assignmentFields)
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to change.")
  .refine((v) => !(v.allowText === false && v.allowFile === false), {
    path: ["allowText"],
    message: "Allow a text answer, files, or both.",
  });
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export const initSubmissionFileSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(ATTACHMENT_MIME_TYPES, {
    errorMap: () => ({
      message: "That file type can't be uploaded. Use PDF, Office, text, image or zip files.",
    }),
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(SUBMISSION_FILE_MAX_BYTES, `Files can be at most ${SUBMISSION_FILE_MAX_BYTES / 1024 ** 2} MB.`),
});
export type InitSubmissionFileInput = z.infer<typeof initSubmissionFileSchema>;

export const submitAssignmentSchema = z.object({
  text: z.string().trim().max(50_000, "Keep the answer under 50,000 characters.").optional(),
  fileKeys: z.array(z.string().min(1).max(400)).max(MAX_SUBMISSION_FILES).default([]),
});
/** `z.input`: fileKeys may be omitted (defaults to none). */
export type SubmitAssignmentInput = z.input<typeof submitAssignmentSchema>;

export const gradeSubmissionSchema = z.object({
  score: z.coerce.number().int().min(0, "The score can't be negative."),
  feedback: z.string().trim().max(10_000).optional(),
});
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;

// ── MCQ quizzes ──

export const MAX_QUIZ_QUESTIONS = 100;

export const quizQuestionSchema = z
  .object({
    prompt: z.string().trim().min(1, "Write the question.").max(2000),
    options: z
      .array(z.string().trim().min(1, "Options can't be empty.").max(500))
      .min(2, "Give at least 2 options.")
      .max(6, "At most 6 options."),
    correct: z.array(z.number().int().min(0)).min(1, "Mark at least one correct option."),
    points: z.coerce.number().int().min(1).max(100).default(1),
  })
  .refine((q) => q.correct.every((i) => i < q.options.length), {
    path: ["correct"],
    message: "A correct answer points at an option that doesn't exist.",
  });

export const saveQuizSchema = z.object({
  title: z.string().trim().min(3, "Title is too short.").max(160),
  /** Minutes; empty = untimed. */
  timeLimitMinutes: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(1).max(300).optional(),
  ),
  dueAt: z.preprocess((v) => (v === "" || v === null ? undefined : v), isoDate.optional()),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
  shuffle: z.boolean().default(true),
  published: z.boolean().default(false),
  questions: z.array(quizQuestionSchema).min(1, "Add at least one question.").max(MAX_QUIZ_QUESTIONS),
});
export type SaveQuizInput = z.infer<typeof saveQuizSchema>;

export const submitQuizSchema = z.object({
  answers: z.record(z.string().max(64), z.array(z.number().int().min(0).max(9)).max(6)),
});
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;

export const joinRequestSchema = z.object({
  message: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});
export type JoinRequestInput = z.infer<typeof joinRequestSchema>;

export const decideJoinRequestSchema = z.object({ decision: z.enum(["approve", "decline"]) });
export type DecideJoinRequestInput = z.infer<typeof decideJoinRequestSchema>;

// ── Admin: users ──

export const MAX_USERS_PER_IMPORT = 500;
const roleSchema = z.enum(ROLES, {
  errorMap: () => ({ message: `Role must be one of ${ROLES.join(", ")}.` }),
});

export const newUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  name: z.string().trim().min(1, "Enter a name.").max(120),
  role: roleSchema.default("STUDENT"),
});
export type NewUserInput = z.infer<typeof newUserSchema>;

export const createUsersSchema = z.object({
  users: z
    .array(newUserSchema)
    .min(1, "Add at least one user.")
    .max(MAX_USERS_PER_IMPORT, `At most ${MAX_USERS_PER_IMPORT} users at a time.`),
});
export type CreateUsersInput = z.infer<typeof createUsersSchema>;

export const updateUserSchema = z
  .object({ role: roleSchema.optional(), isActive: z.boolean().optional() })
  .refine((v) => v.role !== undefined || v.isActive !== undefined, "Nothing to change.");
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: roleSchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/** Split one CSV line into fields: commas separate, double quotes wrap fields ("" is a literal quote). */
function csvFields(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted && ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

/**
 * Parse a user list exported from a spreadsheet: a header row with `email` and `name` (and optionally `role`),
 * in any order, then one user per line. Returns valid rows plus per-line problems (1-based line numbers).
 */
export function parseUserCsv(text: string): {
  users: NewUserInput[];
  problems: { line: number; message: string }[];
} {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = csvFields(lines[0] ?? "").map((h) => h.toLowerCase());
  const col = { email: header.indexOf("email"), name: header.indexOf("name"), role: header.indexOf("role") };
  if (col.email < 0 || col.name < 0)
    return {
      users: [],
      problems: [{ line: 1, message: 'The first row must name the columns, e.g. "email,name,role".' }],
    };

  const users: NewUserInput[] = [];
  const problems: { line: number; message: string }[] = [];
  const seen = new Set<string>();
  lines.slice(1).forEach((raw, i) => {
    const line = i + 2;
    if (!raw.trim()) return;
    const f = csvFields(raw);
    const parsed = newUserSchema.safeParse({
      email: f[col.email] ?? "",
      name: f[col.name] ?? "",
      role: col.role >= 0 && f[col.role] ? f[col.role]!.toUpperCase() : undefined,
    });
    if (!parsed.success) return problems.push({ line, message: parsed.error.issues[0]!.message });
    if (seen.has(parsed.data.email))
      return problems.push({ line, message: `${parsed.data.email} appears twice.` });
    seen.add(parsed.data.email);
    users.push(parsed.data);
  });
  if (users.length > MAX_USERS_PER_IMPORT)
    problems.push({ line: 1, message: `At most ${MAX_USERS_PER_IMPORT} users at a time; split the file.` });
  return { users, problems };
}

// ─────────────────────────── Recording consent ───────────────────────────

/** The notice version the student was shown (RECORDING_NOTICE_VERSION). */
export const agreeRecordingSchema = z.object({ version: z.string().trim().min(1).max(40) });
export type AgreeRecordingInput = z.infer<typeof agreeRecordingSchema>;

// ─────────────────────────── Account deletion ───────────────────────────

/** The person types DELETE to confirm, so a stray click can't delete an account. */
export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE", { errorMap: () => ({ message: "Type DELETE to confirm." }) }),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/** The daily email of unread notifications, on or off. */
export const emailDigestSchema = z.object({ enabled: z.boolean() });
export type EmailDigestInput = z.infer<typeof emailDigestSchema>;

// ─────────────────────────── Manual UPI payments ───────────────────────────

const maybeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** What an admin publishes for students to pay to. At least a UPI ID or a phone number. */
export const paymentSettingsSchema = z
  .object({
    upiId: z
      .string()
      .trim()
      .max(100)
      .refine(
        (v) => v === "" || /^[\w.-]{2,64}@[a-zA-Z][\w.-]{1,63}$/.test(v),
        "Enter a UPI ID like school@okaxis.",
      )
      .optional()
      .transform((v) => (v ? v : undefined)),
    payeeName: maybeText(100),
    phone: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || /^(\+91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/\s/g, "")),
        "Enter a 10-digit Indian mobile number.",
      )
      .optional()
      .transform((v) => (v ? v.replace(/[\s-]/g, "") : undefined)),
    instructions: maybeText(1000),
  })
  .refine((s) => s.upiId || s.phone, { message: "Add a UPI ID or a phone number.", path: ["upiId"] });
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;

const paymentImageMime = z.enum(["image/jpeg", "image/png", "image/webp"], {
  errorMap: () => ({ message: "Use a JPEG, PNG or WebP image." }),
});

/** Start an image upload (QR code or payment screenshot); the size limit is checked by the service. */
export const initPaymentImageSchema = z.object({
  mimeType: paymentImageMime,
  sizeBytes: z.number().int().positive(),
});
export type InitPaymentImageInput = z.infer<typeof initPaymentImageSchema>;

export const completeQrSchema = z.object({ qrId: z.string().uuid(), mimeType: paymentImageMime });
export type CompleteQrInput = z.infer<typeof completeQrSchema>;

export const submitPaymentSchema = z.object({
  reference: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{6,35}$/, "Enter the UPI reference (UTR) from your payment app.")),
  note: maybeText(500),
  proof: z.object({ proofId: z.string().uuid(), mimeType: paymentImageMime }).optional(),
});
export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;

export const decidePaymentSchema = z
  .object({ decision: z.enum(["approve", "reject"]), note: maybeText(500) })
  .refine((d) => d.decision === "approve" || d.note, {
    message: "Say why, so the student knows what to fix.",
    path: ["note"],
  });
export type DecidePaymentInput = z.infer<typeof decidePaymentSchema>;

/** Admin: a course's price in whole rupees; 0 (or empty) makes it free again. */
export const coursePriceSchema = z.object({
  priceRupees: z.coerce
    .number({ invalid_type_error: "Enter a price in rupees." })
    .int("Use whole rupees.")
    .min(0)
    .max(1_000_000, "That's more than ₹10,00,000."),
});
export type CoursePriceInput = z.infer<typeof coursePriceSchema>;

export const listPaymentsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
});
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-01.");

/** Admin: payments reported between two local dates (inclusive), for the school's accounts. At most a year. */
export const paymentsExportQuerySchema = z
  .object({
    from: localDate,
    to: localDate,
    status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).default("ALL"),
  })
  .refine((q) => q.from <= q.to, { path: ["to"], message: "The end date is before the start date." })
  .refine((q) => Date.parse(q.to) - Date.parse(q.from) <= 366 * 86_400_000, {
    path: ["to"],
    message: "Export at most a year at a time.",
  });
export type PaymentsExportQuery = z.infer<typeof paymentsExportQuerySchema>;

/** The full new order of a module's lessons (drag and drop). Must list exactly the module's lessons. */
export const lessonOrderSchema = z.object({ lessonIds: z.array(z.string().min(1).max(64)).min(1).max(500) });
export type LessonOrderInput = z.infer<typeof lessonOrderSchema>;

// ─────────────────────────── Gradebook extras ───────────────────────────

/** Excuse (or un-excuse) one student from one assignment or quiz. */
export const gradeExcusalSchema = z.object({
  itemKind: z.enum(["assignment", "quiz"]),
  itemId: z.string().min(1).max(64),
  userId: z.string().min(1).max(64),
  excused: z.boolean(),
});
export type GradeExcusalInput = z.infer<typeof gradeExcusalSchema>;

/** Assignments' share of the total in percent (quizzes get the rest), or null to weigh everything by points. */
export const gradeWeightingSchema = z.object({
  assignmentWeight: z.number().int().min(0).max(100).nullable(),
});
export type GradeWeightingInput = z.infer<typeof gradeWeightingSchema>;

/** School-wide settings (admin). */
export const schoolSettingsSchema = z.object({
  dailyGoalMinutes: z.coerce
    .number({ invalid_type_error: "Enter minutes." })
    .int("Use whole minutes.")
    .min(5, "At least 5 minutes.")
    .max(240, "At most 240 minutes (4 hours)."),
});
export type SchoolSettingsInput = z.infer<typeof schoolSettingsSchema>;
