/**
 * Request schemas shared by API handlers (server validation) and forms (client validation).
 * One schema per use case; keep messages user-readable, they reach the UI.
 */
import { z } from "zod";
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

export const joinRequestSchema = z.object({
  message: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});
export type JoinRequestInput = z.infer<typeof joinRequestSchema>;

export const decideJoinRequestSchema = z.object({ decision: z.enum(["approve", "decline"]) });
export type DecideJoinRequestInput = z.infer<typeof decideJoinRequestSchema>;
