"use client";

import { VIDEO_MIME_TYPES } from "@elearner/core/schemas";
import { useRef, useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { uploadParts } from "./multipart";

type Phase =
  | { name: "idle" }
  | { name: "uploading"; pct: number }
  | { name: "done" }
  | { name: "error"; message: string };

interface UploadCourse {
  id: string;
  title: string;
  modules: { id: string; title: string }[];
}

export function VideoUploader({
  courses,
  initialCourseId,
  initialModuleId,
}: {
  courses: UploadCourse[];
  initialCourseId?: string;
  initialModuleId?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [courseId, setCourseId] = useState(initialCourseId ?? courses[0]?.id ?? "");
  const modules = courses.find((c) => c.id === courseId)?.modules ?? [];
  const [moduleId, setModuleId] = useState(
    modules.some((m) => m.id === initialModuleId) ? initialModuleId! : "",
  );
  const abort = useRef<AbortController | null>(null);
  const videoId = useRef<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const file = f.get("file");
    if (!(file instanceof File) || file.size === 0)
      return setPhase({ name: "error", message: "Choose a video file." });
    if (!(VIDEO_MIME_TYPES as readonly string[]).includes(file.type))
      return setPhase({ name: "error", message: "Upload an MP4, WebM or MOV video." });

    abort.current = new AbortController();
    setPhase({ name: "uploading", pct: 0 });
    try {
      const init = await api<{ videoId: string; partSize: number; partCount: number }>(
        "/api/v1/videos/uploads",
        {
          method: "POST",
          json: {
            courseId,
            title: f.get("title"),
            moduleId: moduleId || undefined,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          },
        },
      );
      videoId.current = init.videoId;
      const parts = await uploadParts({
        file,
        partSize: init.partSize,
        partCount: init.partCount,
        signal: abort.current.signal,
        presign: (partNumbers) =>
          api<{ urls: { partNumber: number; url: string }[] }>(
            `/api/v1/videos/uploads/${init.videoId}/parts`,
            { method: "POST", json: { partNumbers } },
          ).then((r) => r.urls),
        onProgress: (pct) => setPhase({ name: "uploading", pct }),
      });
      await api(`/api/v1/videos/uploads/${init.videoId}/complete`, { method: "POST", json: { parts } });
      setPhase({ name: "done" });
    } catch (err) {
      if (abort.current?.signal.aborted) return setPhase({ name: "idle" });
      setPhase({
        name: "error",
        message:
          err instanceof ApiError ? err.message : "Upload failed. Check your connection and try again.",
      });
    }
  }

  async function cancel() {
    abort.current?.abort();
    if (videoId.current)
      await api(`/api/v1/videos/uploads/${videoId.current}/complete`, { method: "DELETE" }).catch(
        () => undefined,
      );
    setPhase({ name: "idle" });
  }

  if (phase.name === "done") {
    return (
      <FormAlert tone="success">
        Uploaded. We&apos;re preparing the video for streaming. It appears as a lesson in the course in a few
        minutes.
      </FormAlert>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6"
    >
      {phase.name === "error" && <FormAlert>{phase.message}</FormAlert>}
      <Field id="title" name="title" label="Title" required minLength={3} maxLength={160} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="courseId" className="text-sm font-semibold">
          Course
        </label>
        <select
          id="courseId"
          name="courseId"
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setModuleId("");
          }}
          className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="moduleId" className="text-sm font-semibold">
          Module
        </label>
        <select
          id="moduleId"
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          aria-describedby="moduleId-hint"
          className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5"
        >
          <option value="">Videos (added automatically)</option>
          {modules
            .filter((m) => m.title !== "Videos")
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
        </select>
        <p id="moduleId-hint" className="text-[13px] text-muted">
          The video becomes a lesson at the end of this module.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="file" className="text-sm font-semibold">
          Video file
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept={VIDEO_MIME_TYPES.join(",")}
          required
          className="text-sm file:mr-3 file:h-11 file:rounded-[var(--radius-control)] file:border-0 file:bg-primary-soft file:px-4 file:font-semibold file:text-primary-fg-strong"
        />
      </div>
      {phase.name === "uploading" ? (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span>Uploading…</span>
            <span>{phase.pct}%</span>
          </div>
          <div
            className="h-2 rounded-full bg-[#ECEEF2]"
            role="progressbar"
            aria-valuenow={phase.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div
              className="h-2 rounded-full bg-primary transition-[width]"
              style={{ width: `${phase.pct}%` }}
            />
          </div>
          <Button variant="secondary" onClick={cancel}>
            Cancel upload
          </Button>
        </div>
      ) : (
        <Button type="submit">Upload</Button>
      )}
    </form>
  );
}
