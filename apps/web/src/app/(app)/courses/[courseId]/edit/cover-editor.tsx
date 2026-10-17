"use client";

import { COVER_MAX_BYTES, COVER_MIME_TYPES } from "@elearner/core/schemas";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CourseTile } from "@/components/course-tile";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/** Upload, replace or remove a course's cover image (straight to storage, then recorded). */
export function CoverEditor({
  course,
}: {
  course: { id: string; title: string; grade: string | null; color: string; coverVersion: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function upload(file: File) {
    setNote(null);
    if (!(file.type in COVER_MIME_TYPES))
      return setNote({ tone: "error", text: "Use a JPEG, PNG or WebP image." });
    if (file.size > COVER_MAX_BYTES)
      return setNote({
        tone: "error",
        text: `Cover images can be at most ${COVER_MAX_BYTES / 1024 ** 2} MB.`,
      });
    setBusy(true);
    try {
      const init = await api<{ coverId: string; uploadUrl: string }>(
        `/api/v1/courses/${course.id}/cover/uploads`,
        {
          method: "POST",
          json: { mimeType: file.type, sizeBytes: file.size },
        },
      );
      const put = await fetch(init.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type },
      });
      if (!put.ok) throw new Error("upload");
      await api(`/api/v1/courses/${course.id}/cover`, {
        method: "PUT",
        json: { coverId: init.coverId, mimeType: file.type },
      });
      setNote({
        tone: "success",
        text: "Cover saved. Students see it in the catalog and on the course page.",
      });
      router.refresh();
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : "The upload didn't work. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setNote(null);
    try {
      await api(`/api/v1/courses/${course.id}/cover`, { method: "DELETE" });
      setNote({ tone: "success", text: "Cover removed. The course uses its coloured tile again." });
      router.refresh();
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : "That didn't work. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <CourseTile
        title={course.title}
        grade={course.grade}
        color={course.color}
        cover={{ courseId: course.id, version: course.coverVersion }}
        className="h-36 sm:w-64"
      />
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          JPEG, PNG or WebP, up to {COVER_MAX_BYTES / 1024 ** 2} MB. A wide image (about 16:9) looks best.
          Without one, the course shows a tile in its colour.
        </p>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {course.coverVersion ? "Replace the cover image" : "Choose a cover image"}
          <input
            type="file"
            accept={Object.keys(COVER_MIME_TYPES).join(",")}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
            className="text-sm font-normal file:mr-3 file:h-11 file:rounded-[var(--radius-control)] file:border file:border-line-strong file:bg-surface file:px-4 file:font-semibold"
          />
        </label>
        {course.coverVersion && (
          <Button variant="secondary" disabled={busy} onClick={() => void remove()} className="w-fit">
            Remove cover
          </Button>
        )}
        <div aria-live="polite">
          {busy ? (
            <p className="text-sm text-muted">Uploading…</p>
          ) : (
            note && <FormAlert tone={note.tone}>{note.text}</FormAlert>
          )}
        </div>
      </div>
    </div>
  );
}
