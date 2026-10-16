import { isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { LessonDoneButton } from "@/components/lesson-done-button";
import { buttonClasses } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { fileSize } from "@/lib/format";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getLessonView } from "@/server/services/learning";
import { getPlayerData } from "@/server/services/videos";

export const metadata: Metadata = { title: "Lesson" };

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const actor = await requirePageActor(["ADMIN", "TEACHER", "STUDENT"]);
  const { courseId, lessonId } = await params;
  const lesson = await getLessonView(deps(), actor, lessonId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  if (lesson.courseId !== courseId) notFound();
  const player = lesson.video?.ready ? await getPlayerData(deps(), actor, lesson.video.id) : null;
  const student = actor.role === "STUDENT";

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/courses/${lesson.courseId}`}
          className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
        >
          <Icon name="chevronLeft" size={16} />
          {lesson.courseTitle}
        </Link>
        {lesson.canManage && (
          <Link
            href={`/courses/${lesson.courseId}/lessons/${lesson.id}/edit`}
            className={buttonClasses("secondary")}
          >
            <Icon name="edit" size={18} />
            Edit lesson
          </Link>
        )}
      </div>

      {lesson.hidden && (
        <p role="status" className="rounded-[var(--radius-control)] bg-canvas px-3 py-2.5 text-sm">
          This lesson is hidden. Students can&apos;t see it until you show it.
        </p>
      )}

      {lesson.video &&
        (player ? (
          <VideoPlayer
            videoId={player.id}
            src={player.playlistUrl}
            poster={player.posterUrl}
            resumeAt={player.resumeAtSeconds}
          />
        ) : (
          <div className="grid aspect-video place-items-center rounded-[var(--radius-card)] bg-[#1D2233] p-6 text-center text-[#C9CCD6]">
            <p>
              {lesson.video.failed
                ? "This video couldn't be processed. Try uploading it again."
                : "This video is still processing. Check back in a few minutes."}
            </p>
          </div>
        ))}

      <header>
        <p className="text-sm font-semibold text-muted">
          {lesson.moduleTitle}
          {lesson.number !== null && ` · Lesson ${lesson.number} of ${lesson.total}`}
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{lesson.title}</h1>
      </header>

      {lesson.body && (
        <div className="max-w-prose whitespace-pre-line text-[16px] leading-relaxed">{lesson.body}</div>
      )}

      {lesson.url && (
        <a
          href={lesson.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses("primary", "w-fit")}
        >
          <Icon name="link" size={18} />
          Open the link
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}

      {lesson.attachments.length > 0 && (
        <section
          aria-labelledby="files-h"
          className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
        >
          <h2 id="files-h" className="mb-2 font-display text-xl font-bold">
            Files
          </h2>
          <ul className="divide-y divide-line">
            {lesson.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={`/api/v1/attachments/${a.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-canvas"
                >
                  <Icon name="file" size={20} className="shrink-0 text-primary-fg" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{a.fileName}</span>
                  <span className="text-sm text-muted">{fileSize(a.sizeBytes)}</span>
                  <Icon name="download" size={18} className="shrink-0" />
                  <span className="sr-only">Download</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {student && lesson.type !== "VIDEO" && (
        <LessonDoneButton lessonId={lesson.id} done={lesson.completed} />
      )}

      <nav aria-label="Lessons" className="flex flex-wrap justify-between gap-3 border-t border-line pt-4">
        {lesson.prev ? (
          <Link
            href={`/courses/${lesson.courseId}/lessons/${lesson.prev.id}`}
            className={buttonClasses("secondary", "max-w-full")}
          >
            <Icon name="chevronLeft" size={18} />
            <span className="truncate">Previous: {lesson.prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {lesson.next && (
          <Link
            href={`/courses/${lesson.courseId}/lessons/${lesson.next.id}`}
            className={buttonClasses("primary", "max-w-full")}
          >
            <span className="truncate">Next: {lesson.next.title}</span>
            <Icon name="chevronRight" size={18} />
          </Link>
        )}
      </nav>
    </div>
  );
}
