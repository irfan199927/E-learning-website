"use client";

import { ATTACHMENT_MIME_TYPES } from "@elearner/core/schemas";
import { MAX_SUBMISSION_FILES, SUBMISSION_FILE_MAX_BYTES } from "@elearner/core/grading";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormAlert } from "@/components/form";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

interface FileItem {
  key: string;
  name: string;
}

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

/** The student's answer: text and/or files, uploaded straight to storage, then handed in. */
export function SubmitForm({
  assignmentId,
  allowText,
  allowFile,
  initialText,
  initialFiles,
  again,
}: {
  assignmentId: string;
  allowText: boolean;
  allowFile: boolean;
  initialText: string;
  initialFiles: FileItem[];
  again: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialText);
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setNote(null);
    for (const file of Array.from(list)) {
      if (files.length >= MAX_SUBMISSION_FILES) {
        setNote({ tone: "error", text: `You can add at most ${MAX_SUBMISSION_FILES} files.` });
        break;
      }
      if (file.size > SUBMISSION_FILE_MAX_BYTES) {
        setNote({
          tone: "error",
          text: `${file.name} is larger than ${SUBMISSION_FILE_MAX_BYTES / 1024 ** 2} MB.`,
        });
        continue;
      }
      setBusy(`Uploading ${file.name}…`);
      try {
        const mimeType = mimeOf(file);
        const { fileKey, uploadUrl } = await api<{ fileKey: string; uploadUrl: string }>(
          `/api/v1/assignments/${assignmentId}/files`,
          { method: "POST", json: { fileName: file.name, mimeType, sizeBytes: file.size } },
        );
        const put = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "content-type": mimeType },
        });
        if (!put.ok) throw new Error(`Upload of ${file.name} failed.`);
        setFiles((f) => [...f, { key: fileKey, name: file.name }]);
      } catch (err) {
        setNote({
          tone: "error",
          text: err instanceof ApiError || err instanceof Error ? err.message : "Upload failed.",
        });
      }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
  }

  async function submit() {
    setBusy("Handing in…");
    setNote(null);
    try {
      await api(`/api/v1/assignments/${assignmentId}/submission`, {
        method: "PUT",
        json: { text: allowText ? text : undefined, fileKeys: files.map((f) => f.key) },
      });
      setNote({ tone: "success", text: "Handed in. Your teacher will grade it." });
      router.refresh();
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Couldn't hand in. Try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {allowText && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="answer" className="text-sm font-semibold">
            Your answer
          </label>
          <textarea
            id="answer"
            rows={10}
            maxLength={50000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px]"
          />
        </div>
      )}
      {allowFile && (
        <div className="flex flex-col gap-2">
          {files.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {files.map((f) => (
                <li key={f.key} className="flex items-center gap-2 text-sm">
                  <Icon name="file" size={18} className="shrink-0 text-primary-fg" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <Button
                    variant="ghost"
                    className="h-9 px-2 text-sm"
                    onClick={() => setFiles((all) => all.filter((x) => x.key !== f.key))}
                    aria-label={`Remove ${f.name}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <label htmlFor="files" className="text-sm font-semibold">
            Add files
          </label>
          <input
            ref={input}
            id="files"
            type="file"
            multiple
            disabled={!!busy || files.length >= MAX_SUBMISSION_FILES}
            onChange={(e) => void addFiles(e.target.files)}
            aria-describedby="files-hint"
            className="text-sm file:mr-3 file:h-11 file:rounded-[var(--radius-control)] file:border-0 file:bg-primary-soft file:px-4 file:font-semibold file:text-primary-fg-strong"
          />
          <p id="files-hint" className="text-[13px] text-muted">
            Up to {MAX_SUBMISSION_FILES} files: PDF, Office, images, text or zip,{" "}
            {SUBMISSION_FILE_MAX_BYTES / 1024 ** 2} MB each.
          </p>
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm">
        {busy}
      </p>
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <Button
        disabled={!!busy || (!text.trim() && files.length === 0)}
        onClick={() => void submit()}
        className="w-fit"
      >
        {again ? "Hand in again" : "Hand in"}
      </Button>
    </div>
  );
}
