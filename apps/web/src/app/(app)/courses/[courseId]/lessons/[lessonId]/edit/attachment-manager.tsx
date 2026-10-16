"use client";

import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES } from "@elearner/core/schemas";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormAlert } from "@/components/form";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { fileSize } from "@/lib/format";

export interface AttachmentRow {
  id: string;
  fileName: string;
  sizeBytes: number;
}

const ACCEPT = [
  ...ATTACHMENT_MIME_TYPES,
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp,.ods,.zip,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp",
].join(",");

/** Browsers report some types inconsistently (e.g. CSV on Windows); fall back on the extension. */
const BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
  pdf: "application/pdf",
};

function mimeOf(file: File): string {
  if ((ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) return file.type;
  return BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? file.type;
}

/** Upload files to a lesson (straight to storage), list them, and delete them. */
export function AttachmentManager({ lessonId, files }: { lessonId: string; files: AttachmentRow[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setNote(null);
    const failed: string[] = [];
    let done = 0;
    for (const file of Array.from(list)) {
      setStatus(`Uploading ${file.name}…`);
      try {
        if (file.size > ATTACHMENT_MAX_BYTES)
          throw new Error(`${file.name} is larger than ${ATTACHMENT_MAX_BYTES / 1024 ** 2} MB.`);
        const mimeType = mimeOf(file);
        const init = await api<{ attachmentId: string; uploadUrl: string }>(
          `/api/v1/lessons/${lessonId}/attachments/uploads`,
          { method: "POST", json: { fileName: file.name, mimeType, sizeBytes: file.size } },
        );
        const put = await fetch(init.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "content-type": mimeType },
        });
        if (!put.ok) throw new Error(`Upload of ${file.name} failed.`);
        await api(`/api/v1/lessons/${lessonId}/attachments`, {
          method: "POST",
          json: { attachmentId: init.attachmentId, fileName: file.name, mimeType },
        });
        done++;
      } catch (err) {
        failed.push(
          err instanceof ApiError || err instanceof Error ? `${file.name}: ${err.message}` : file.name,
        );
      }
    }
    setStatus(null);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (failed.length) setNote({ tone: "error", text: failed.join(" ") });
    else setNote({ tone: "success", text: done === 1 ? "File added." : `${done} files added.` });
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    setNote(null);
    try {
      await api(`/api/v1/attachments/${id}`, { method: "DELETE" });
      setConfirming(null);
      router.refresh();
    } catch (err) {
      setNote({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn't delete. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      {files.length === 0 ? (
        <p className="text-muted">No files yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 py-2">
              <Icon name="file" size={20} className="shrink-0 text-primary-fg" />
              <a
                href={`/api/v1/attachments/${f.id}`}
                className="min-w-0 flex-1 truncate font-semibold hover:underline"
              >
                {f.fileName}
              </a>
              <span className="text-sm text-muted">{fileSize(f.sizeBytes)}</span>
              {confirming === f.id ? (
                <span role="group" aria-label={`Confirm removing ${f.fileName}`} className="flex gap-2">
                  <Button variant="live" disabled={busy} onClick={() => void remove(f.id)}>
                    Remove
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirming(null)}>
                    Keep
                  </Button>
                </span>
              ) : (
                <Button
                  variant="secondary"
                  className="w-11 px-0!"
                  disabled={busy}
                  onClick={() => setConfirming(f.id)}
                  aria-label={`Remove ${f.fileName}`}
                >
                  <Icon name="trash" size={18} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="files" className="text-sm font-semibold">
          Add files
        </label>
        <input
          ref={input}
          id="files"
          type="file"
          multiple
          accept={ACCEPT}
          disabled={busy}
          onChange={(e) => void upload(e.target.files)}
          aria-describedby="files-hint"
          className="text-sm file:mr-3 file:h-11 file:rounded-[var(--radius-control)] file:border-0 file:bg-primary-soft file:px-4 file:font-semibold file:text-primary-fg-strong"
        />
        <p id="files-hint" className="text-[13px] text-muted">
          PDF, Word, PowerPoint, Excel, OpenDocument, text, CSV, images or zip, up to{" "}
          {ATTACHMENT_MAX_BYTES / 1024 ** 2} MB each. Students download them from the lesson.
        </p>
      </div>
      <p role="status" aria-live="polite" className="text-sm">
        {status}
      </p>
    </div>
  );
}
