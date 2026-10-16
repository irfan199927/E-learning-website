"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/form";
import { Icon, type IconName } from "@/components/icons";
import { Button, buttonClasses } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

type LessonType = "VIDEO" | "NOTE" | "LINK" | "DOCUMENT" | "QUIZ" | "ASSIGNMENT";

export interface EditorLesson {
  id: string;
  title: string;
  type: LessonType;
  published: boolean;
  videoStatus: string | null;
  attachmentCount: number;
}

export interface EditorModule {
  id: string;
  title: string;
  lessons: EditorLesson[];
}

const TYPE_LABEL: Record<LessonType, { label: string; icon: IconName }> = {
  VIDEO: { label: "Video", icon: "play" },
  NOTE: { label: "Reading", icon: "text" },
  LINK: { label: "Link", icon: "link" },
  DOCUMENT: { label: "Files", icon: "file" },
  QUIZ: { label: "Quiz", icon: "check" },
  ASSIGNMENT: { label: "Assignment", icon: "file" },
};

const VIDEO_STATUS: Record<string, string> = {
  PENDING_UPLOAD: "Uploading",
  UPLOADED: "Queued for processing",
  TRANSCODING: "Processing",
  FAILED: "Processing failed",
};

const inputCls =
  "h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] min-w-0";
// Square 44px icon buttons; `px-0!` beats the base `px-4` (same specificity, so order in the CSS would decide).
const iconBtn = "w-11 px-0!";

/** Shared busy/error state: every action calls the API, then re-renders the page from the server. */
function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  async function run(fn: () => Promise<unknown>, success?: string): Promise<boolean> {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      if (success) setNote({ tone: "success", text: success });
      router.refresh();
      return true;
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : "That didn't work. Try again.",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, note, run };
}

export function OutlineEditor({
  courseId,
  modules,
  looseVideos,
}: {
  courseId: string;
  modules: EditorModule[];
  looseVideos: { id: string; title: string; status: string }[];
}) {
  const { busy, note, run } = useAction();

  async function addModule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const title = String(new FormData(form).get("title") ?? "").trim();
    const ok = await run(() =>
      api(`/api/v1/courses/${courseId}/modules`, { method: "POST", json: { title } }),
    );
    if (ok) form.reset();
  }

  return (
    <div className="flex flex-col gap-5">
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      {modules.length === 0 && (
        <p className="text-muted">
          Start with a module, for example &ldquo;Week 1&rdquo; or &ldquo;Chapter 1: Number systems&rdquo;.
          Then add lessons to it.
        </p>
      )}
      {modules.map((m, i) => (
        <ModuleCard
          key={m.id}
          courseId={courseId}
          module={m}
          isFirst={i === 0}
          isLast={i === modules.length - 1}
        />
      ))}

      <form
        onSubmit={addModule}
        className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong p-4 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="new-module" className="text-sm font-semibold">
            New module
          </label>
          <input id="new-module" name="title" required maxLength={120} className={inputCls} />
        </div>
        <Button type="submit" disabled={busy}>
          <Icon name="plus" size={18} />
          Add module
        </Button>
      </form>

      {looseVideos.length > 0 && (
        <section
          aria-labelledby="loose-h"
          className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
        >
          <h3 id="loose-h" className="font-display text-lg font-bold">
            Videos not in a lesson ({looseVideos.length})
          </h3>
          <p className="mb-3 text-sm text-muted">Students can&apos;t see these. Add them to a module.</p>
          <ul className="flex flex-col divide-y divide-line">
            {looseVideos.map((v) => (
              <LooseVideo key={v.id} video={v} modules={modules} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ModuleCard({
  courseId,
  module: m,
  isFirst,
  isLast,
}: {
  courseId: string;
  module: EditorModule;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { busy, note, run } = useAction();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const headingId = `module-${m.id}`;
  const patch = (json: object) => api(`/api/v1/modules/${m.id}`, { method: "PATCH", json });

  async function rename(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = String(new FormData(e.currentTarget).get("title") ?? "").trim();
    if (await run(() => patch({ title }))) setRenaming(false);
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {renaming ? (
          <form onSubmit={rename} className="flex flex-1 flex-wrap items-end gap-2">
            <label htmlFor={`rename-${m.id}`} className="sr-only">
              Module name
            </label>
            <input
              id={`rename-${m.id}`}
              name="title"
              defaultValue={m.title}
              required
              maxLength={120}
              autoFocus
              className={`${inputCls} flex-1`}
            />
            <Button type="submit" disabled={busy}>
              Save
            </Button>
            <Button variant="secondary" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <h3 id={headingId} className="font-display text-lg font-bold">
            {m.title}
          </h3>
        )}
        {!renaming && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Module ${m.title}`}>
            <Button variant="secondary" onClick={() => setRenaming(true)}>
              Rename
            </Button>
            <Button
              variant="secondary"
              className={iconBtn}
              disabled={busy || isFirst}
              onClick={() => void run(() => patch({ move: "up" }))}
              aria-label={`Move module ${m.title} up`}
            >
              <Icon name="arrowUp" size={18} />
            </Button>
            <Button
              variant="secondary"
              className={iconBtn}
              disabled={busy || isLast}
              onClick={() => void run(() => patch({ move: "down" }))}
              aria-label={`Move module ${m.title} down`}
            >
              <Icon name="arrowDown" size={18} />
            </Button>
            {m.lessons.length === 0 &&
              (confirmDelete ? (
                <>
                  <Button
                    variant="live"
                    disabled={busy}
                    onClick={() => void run(() => api(`/api/v1/modules/${m.id}`, { method: "DELETE" }))}
                  >
                    Delete module
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  className={iconBtn}
                  onClick={() => setConfirmDelete(true)}
                  aria-label={`Delete module ${m.title}`}
                >
                  <Icon name="trash" size={18} />
                </Button>
              ))}
          </div>
        )}
      </div>
      {note && (
        <div className="mt-3">
          <FormAlert tone={note.tone}>{note.text}</FormAlert>
        </div>
      )}

      {m.lessons.length === 0 ? (
        <p className="py-3 text-sm text-muted">No lessons in this module yet.</p>
      ) : (
        <ol className="mt-2 flex flex-col divide-y divide-line">
          {m.lessons.map((l, i) => (
            <LessonRow
              key={l.id}
              courseId={courseId}
              lesson={l}
              isFirst={i === 0}
              isLast={i === m.lessons.length - 1}
            />
          ))}
        </ol>
      )}
      <AddLesson courseId={courseId} module={m} />
    </section>
  );
}

function LessonRow({
  courseId,
  lesson: l,
  isFirst,
  isLast,
}: {
  courseId: string;
  lesson: EditorLesson;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { busy, note, run } = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const type = TYPE_LABEL[l.type];
  const patch = (json: object) => api(`/api/v1/lessons/${l.id}`, { method: "PATCH", json });
  const meta = [
    type.label,
    l.videoStatus ? VIDEO_STATUS[l.videoStatus] : null,
    l.attachmentCount ? `${l.attachmentCount} ${l.attachmentCount === 1 ? "file" : "files"}` : null,
    l.published ? null : "Hidden",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-primary-fg"
          aria-hidden="true"
        >
          <Icon name={l.published ? type.icon : "eyeOff"} size={18} />
        </span>
        <span className="flex min-w-0 flex-col">
          <Link
            href={`/courses/${courseId}/lessons/${l.id}/edit`}
            className="truncate font-semibold text-primary-fg hover:underline"
          >
            {l.title}
          </Link>
          <span className="text-sm text-muted">{meta}</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Lesson ${l.title}`}>
        <Button
          variant="secondary"
          className={iconBtn}
          disabled={busy || isFirst}
          onClick={() => void run(() => patch({ move: "up" }))}
          aria-label={`Move ${l.title} up`}
        >
          <Icon name="arrowUp" size={18} />
        </Button>
        <Button
          variant="secondary"
          className={iconBtn}
          disabled={busy || isLast}
          onClick={() => void run(() => patch({ move: "down" }))}
          aria-label={`Move ${l.title} down`}
        >
          <Icon name="arrowDown" size={18} />
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void run(() => patch({ published: !l.published }))}
          aria-label={`${l.published ? "Hide" : "Show"} ${l.title} ${l.published ? "from" : "to"} students`}
        >
          {l.published ? "Hide" : "Show"}
        </Button>
        {confirmDelete ? (
          <>
            <Button
              variant="live"
              disabled={busy}
              onClick={() => void run(() => api(`/api/v1/lessons/${l.id}`, { method: "DELETE" }))}
            >
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            className={iconBtn}
            onClick={() => setConfirmDelete(true)}
            aria-label={`Delete ${l.title}`}
          >
            <Icon name="trash" size={18} />
          </Button>
        )}
      </div>
      {confirmDelete && (
        <p className="text-sm text-muted lg:basis-full">
          {l.type === "VIDEO"
            ? "Deleting the lesson keeps the video; you can add it again from “Videos not in a lesson”."
            : "This deletes the lesson and its files."}
        </p>
      )}
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
    </li>
  );
}

type NewType = "NOTE" | "LINK" | "DOCUMENT" | "VIDEO";

function AddLesson({ courseId, module: m }: { courseId: string; module: EditorModule }) {
  const { busy, note, run } = useAction();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<NewType>("NOTE");
  const id = (k: string) => `${k}-${m.id}`;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    const json =
      type === "NOTE"
        ? { type, title: text("title"), body: text("body") }
        : type === "LINK"
          ? { type, title: text("title"), url: text("url"), body: text("body") || undefined }
          : { type: "DOCUMENT", title: text("title"), body: text("body") || undefined };
    const created: { id?: string } = {};
    const ok = await run(async () => {
      created.id = (
        await api<{ id: string }>(`/api/v1/modules/${m.id}/lessons`, { method: "POST", json })
      ).id;
    });
    if (!ok) return;
    // File lessons need their files next: go straight to the lesson's editor.
    if (type === "DOCUMENT" && created.id) router.push(`/courses/${courseId}/lessons/${created.id}/edit`);
    else setOpen(false);
  }

  if (!open)
    return (
      <div className="mt-3">
        <Button variant="ghost" onClick={() => setOpen(true)} aria-label={`Add a lesson to ${m.title}`}>
          <Icon name="plus" size={18} />
          Add lesson
        </Button>
      </div>
    );

  return (
    <form
      onSubmit={submit}
      className="mt-3 flex flex-col gap-3 rounded-[var(--radius-control)] bg-canvas p-4"
      noValidate
    >
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Lesson type</legend>
        <div className="flex flex-wrap gap-2">
          {(["NOTE", "LINK", "DOCUMENT", "VIDEO"] as const).map((t) => (
            <label
              key={t}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 has-[:checked]:border-2 has-[:checked]:border-primary"
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="size-4"
              />
              <Icon name={TYPE_LABEL[t].icon} size={16} />
              <span className="text-sm">{TYPE_LABEL[t].label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {type === "VIDEO" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Upload a video file. It becomes a lesson in {m.title} and appears for students once processed.
          </p>
          <Link
            href={`/library/upload?course=${courseId}&module=${m.id}`}
            className={buttonClasses("primary", "w-fit")}
          >
            <Icon name="upload" size={18} />
            Upload a video
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("title")} className="text-sm font-semibold">
              Title
            </label>
            <input id={id("title")} name="title" required maxLength={160} className={inputCls} />
          </div>
          {type === "LINK" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={id("url")} className="text-sm font-semibold">
                Web address
              </label>
              <input
                id={id("url")}
                name="url"
                type="url"
                inputMode="url"
                placeholder="https://"
                required
                maxLength={2000}
                className={inputCls}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("body")} className="text-sm font-semibold">
              {type === "NOTE" ? "Text" : "Instructions (optional)"}
            </label>
            <textarea
              id={id("body")}
              name="body"
              rows={type === "NOTE" ? 6 : 3}
              maxLength={20000}
              className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px]"
            />
          </div>
          {type === "DOCUMENT" && (
            <p className="text-sm text-muted">
              After you add the lesson, you can attach PDFs, slides and other files.
            </p>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {type !== "VIDEO" && (
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add lesson"}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function LooseVideo({
  video,
  modules,
}: {
  video: { id: string; title: string; status: string };
  modules: EditorModule[];
}) {
  const { busy, note, run } = useAction();
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const selectId = `loose-${video.id}`;

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{video.title}</p>
        <p className="text-sm text-muted">{VIDEO_STATUS[video.status] ?? "Ready"}</p>
      </div>
      {modules.length === 0 ? (
        <p className="text-sm text-muted">Add a module first.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={selectId} className="text-sm font-semibold">
              Module
            </label>
            <select
              id={selectId}
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className={inputCls}
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={busy}
            onClick={() =>
              void run(() =>
                api(`/api/v1/modules/${moduleId}/lessons`, {
                  method: "POST",
                  json: { type: "VIDEO", title: video.title.slice(0, 160), videoId: video.id },
                }),
              )
            }
            aria-label={`Add ${video.title} as a lesson`}
          >
            Add as lesson
          </Button>
        </>
      )}
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
    </li>
  );
}
