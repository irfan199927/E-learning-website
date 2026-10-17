"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/form";
import { Icon, type IconName } from "@/components/icons";
import { Button, buttonClasses } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { MarkdownField } from "@/components/markdown-field";

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

/** Labels are `CourseEditor.lessonType.<type>`. */
const TYPE_ICON: Record<LessonType, IconName> = {
  VIDEO: "play",
  NOTE: "text",
  LINK: "link",
  DOCUMENT: "file",
  QUIZ: "check",
  ASSIGNMENT: "file",
};

/** Video states with a label (`CourseEditor.videoStatus`); READY says nothing. */
const VIDEO_STATUS = ["PENDING_UPLOAD", "UPLOADED", "TRANSCODING", "FAILED"] as const;
const hasStatusLabel = (status: string): status is (typeof VIDEO_STATUS)[number] =>
  (VIDEO_STATUS as readonly string[]).includes(status);

const inputCls =
  "h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] min-w-0";
// Square 44px icon buttons; `px-0!` beats the base `px-4` (same specificity, so order in the CSS would decide).
const iconBtn = "w-11 px-0!";

/** Shared busy/error state: every action calls the API, then re-renders the page from the server. */
function useAction() {
  const t = useTranslations("CourseEditor");
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
        text: err instanceof ApiError ? err.message : t("failed"),
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
  const t = useTranslations("CourseEditor");
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
      {modules.length === 0 && <p className="text-muted">{t("startHint")}</p>}
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
            {t("newModule")}
          </label>
          <input id="new-module" name="title" required maxLength={120} className={inputCls} />
        </div>
        <Button type="submit" disabled={busy}>
          <Icon name="plus" size={18} />
          {t("addModule")}
        </Button>
      </form>

      {looseVideos.length > 0 && (
        <section
          aria-labelledby="loose-h"
          className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
        >
          <h3 id="loose-h" className="font-display text-lg font-bold">
            {t("looseTitle", { count: looseVideos.length })}
          </h3>
          <p className="mb-3 text-sm text-muted">{t("looseHelp")}</p>
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
  const t = useTranslations("CourseEditor");
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
              {t("moduleName")}
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
              {t("save")}
            </Button>
            <Button variant="secondary" onClick={() => setRenaming(false)}>
              {t("cancel")}
            </Button>
          </form>
        ) : (
          <h3 id={headingId} className="font-display text-lg font-bold">
            {m.title}
          </h3>
        )}
        {!renaming && (
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t("moduleGroup", { title: m.title })}
          >
            <Button variant="secondary" onClick={() => setRenaming(true)}>
              {t("rename")}
            </Button>
            <Button
              variant="secondary"
              className={iconBtn}
              disabled={busy || isFirst}
              onClick={() => void run(() => patch({ move: "up" }))}
              aria-label={t("moveModuleUp", { title: m.title })}
            >
              <Icon name="arrowUp" size={18} />
            </Button>
            <Button
              variant="secondary"
              className={iconBtn}
              disabled={busy || isLast}
              onClick={() => void run(() => patch({ move: "down" }))}
              aria-label={t("moveModuleDown", { title: m.title })}
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
                    {t("deleteModule")}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                    {t("keep")}
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  className={iconBtn}
                  onClick={() => setConfirmDelete(true)}
                  aria-label={t("deleteModuleNamed", { title: m.title })}
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
        <p className="py-3 text-sm text-muted">{t("noLessons")}</p>
      ) : (
        <DraggableLessons courseId={courseId} moduleId={m.id} lessons={m.lessons} />
      )}
      <AddLesson courseId={courseId} module={m} />
    </section>
  );
}

/**
 * Lessons in a module, reorderable by drag and drop (mouse and touch-screen pointers that support HTML5 drag).
 * Keyboard and screen-reader users have the Move up / Move down buttons on each row; a drop is announced.
 */
function DraggableLessons({
  courseId,
  moduleId,
  lessons,
}: {
  courseId: string;
  moduleId: string;
  lessons: EditorLesson[];
}) {
  const t = useTranslations("CourseEditor");
  const router = useRouter();
  const [order, setOrder] = useState(lessons);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(lessons);
  if (synced !== lessons) {
    // New server data (after any change): start again from it.
    setSynced(lessons);
    setOrder(lessons);
  }

  async function drop(targetId: string) {
    const from = order.findIndex((l) => l.id === dragging);
    const to = order.findIndex((l) => l.id === targetId);
    setDragging(null);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setOrder(next);
    setError(null);
    try {
      await api(`/api/v1/modules/${moduleId}/lesson-order`, {
        method: "PUT",
        json: { lessonIds: next.map((l) => l.id) },
      });
      setAnnounce(t("moved", { title: moved!.title, position: to + 1, total: next.length }));
      router.refresh();
    } catch (err) {
      setOrder(lessons);
      setError(err instanceof ApiError ? err.message : t("failed"));
    }
  }

  return (
    <>
      <ol className="mt-2 flex flex-col divide-y divide-line">
        {order.map((l, i) => (
          <LessonRow
            key={l.id}
            courseId={courseId}
            lesson={l}
            isFirst={i === 0}
            isLast={i === order.length - 1}
            drag={{
              active: dragging === l.id,
              onStart: () => setDragging(l.id),
              onEnd: () => setDragging(null),
              onDrop: () => void drop(l.id),
            }}
          />
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {error && <FormAlert>{error}</FormAlert>}
    </>
  );
}

function LessonRow({
  courseId,
  lesson: l,
  isFirst,
  isLast,
  drag,
}: {
  courseId: string;
  lesson: EditorLesson;
  isFirst: boolean;
  isLast: boolean;
  drag: { active: boolean; onStart: () => void; onEnd: () => void; onDrop: () => void };
}) {
  const t = useTranslations("CourseEditor");
  const { busy, note, run } = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const patch = (json: object) => api(`/api/v1/lessons/${l.id}`, { method: "PATCH", json });
  const meta = [
    t(`lessonType.${l.type}`),
    l.videoStatus && hasStatusLabel(l.videoStatus) ? t(`videoStatus.${l.videoStatus}`) : null,
    l.attachmentCount ? t("files", { count: l.attachmentCount }) : null,
    l.published ? null : t("hidden"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", l.title);
        drag.onStart();
      }}
      onDragEnd={drag.onEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        drag.onDrop();
      }}
      className={`flex flex-col gap-2 py-3 lg:flex-row lg:items-center ${drag.active ? "opacity-50" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="cursor-grab select-none text-muted" aria-hidden="true" title={t("dragToReorder")}>
          ⠿
        </span>
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-primary-fg"
          aria-hidden="true"
        >
          <Icon name={l.published ? TYPE_ICON[l.type] : "eyeOff"} size={18} />
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
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("lessonGroup", { title: l.title })}>
        <Button
          variant="secondary"
          className={iconBtn}
          disabled={busy || isFirst}
          onClick={() => void run(() => patch({ move: "up" }))}
          aria-label={t("moveUp", { title: l.title })}
        >
          <Icon name="arrowUp" size={18} />
        </Button>
        <Button
          variant="secondary"
          className={iconBtn}
          disabled={busy || isLast}
          onClick={() => void run(() => patch({ move: "down" }))}
          aria-label={t("moveDown", { title: l.title })}
        >
          <Icon name="arrowDown" size={18} />
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void run(() => patch({ published: !l.published }))}
          aria-label={l.published ? t("hideFrom", { title: l.title }) : t("showTo", { title: l.title })}
        >
          {l.published ? t("hide") : t("show")}
        </Button>
        {confirmDelete ? (
          <>
            <Button
              variant="live"
              disabled={busy}
              onClick={() => void run(() => api(`/api/v1/lessons/${l.id}`, { method: "DELETE" }))}
            >
              {t("delete")}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {t("keep")}
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            className={iconBtn}
            onClick={() => setConfirmDelete(true)}
            aria-label={t("deleteNamed", { title: l.title })}
          >
            <Icon name="trash" size={18} />
          </Button>
        )}
      </div>
      {confirmDelete && (
        <p className="text-sm text-muted lg:basis-full">
          {l.type === "VIDEO" ? t("deleteVideoLesson") : t("deleteLesson")}
        </p>
      )}
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
    </li>
  );
}

type NewType = "NOTE" | "LINK" | "DOCUMENT" | "VIDEO";

function AddLesson({ courseId, module: m }: { courseId: string; module: EditorModule }) {
  const t = useTranslations("CourseEditor");
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
        <Button
          variant="ghost"
          onClick={() => setOpen(true)}
          aria-label={t("addLessonTo", { title: m.title })}
        >
          <Icon name="plus" size={18} />
          {t("addLesson")}
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
        <legend className="mb-1.5 text-sm font-semibold">{t("lessonTypeLegend")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["NOTE", "LINK", "DOCUMENT", "VIDEO"] as const).map((option) => (
            <label
              key={option}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 has-[:checked]:border-2 has-[:checked]:border-primary"
            >
              <input
                type="radio"
                name="type"
                value={option}
                checked={type === option}
                onChange={() => setType(option)}
                className="size-4"
              />
              <Icon name={TYPE_ICON[option]} size={16} />
              <span className="text-sm">{t(`lessonType.${option}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {type === "VIDEO" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{t("videoHelp", { module: m.title })}</p>
          <Link
            href={`/library/upload?course=${courseId}&module=${m.id}`}
            className={buttonClasses("primary", "w-fit")}
          >
            <Icon name="upload" size={18} />
            {t("uploadVideo")}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("title")} className="text-sm font-semibold">
              {t("title")}
            </label>
            <input id={id("title")} name="title" required maxLength={160} className={inputCls} />
          </div>
          {type === "LINK" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={id("url")} className="text-sm font-semibold">
                {t("url")}
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
          <MarkdownField
            id={id("body")}
            name="body"
            label={type === "NOTE" ? t("text") : t("instructions")}
            rows={type === "NOTE" ? 6 : 3}
          />
          {type === "DOCUMENT" && <p className="text-sm text-muted">{t("filesHelp")}</p>}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {type !== "VIDEO" && (
          <Button type="submit" disabled={busy}>
            {busy ? t("adding") : t("addLesson")}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setOpen(false)}>
          {t("cancel")}
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
  const t = useTranslations("CourseEditor");
  const { busy, note, run } = useAction();
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const selectId = `loose-${video.id}`;

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{video.title}</p>
        <p className="text-sm text-muted">
          {hasStatusLabel(video.status) ? t(`videoStatus.${video.status}`) : t("ready")}
        </p>
      </div>
      {modules.length === 0 ? (
        <p className="text-sm text-muted">{t("addModuleFirst")}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={selectId} className="text-sm font-semibold">
              {t("module")}
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
            aria-label={t("addAsLessonNamed", { title: video.title })}
          >
            {t("addAsLesson")}
          </Button>
        </>
      )}
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
    </li>
  );
}
