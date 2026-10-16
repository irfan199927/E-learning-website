import { isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getPlayerData } from "@/server/services/videos";
import { VideoPlayer } from "@/components/video-player";

export const metadata: Metadata = { title: "Lesson" };

export default async function LessonPage({ params }: { params: Promise<{ videoId: string }> }) {
  const actor = await requirePageActor();
  const { videoId } = await params;
  const video = await getPlayerData(deps(), actor, videoId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  // Videos in a lesson open on the lesson page (old links, recordings). Staff keep this page for loose videos.
  if (video.lessonId) redirect(`/courses/${video.courseId}/lessons/${video.lessonId}`);

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <Link
        href={`/courses/${video.courseId}`}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        {video.courseTitle}
      </Link>
      {video.status === "READY" ? (
        <VideoPlayer
          videoId={video.id}
          src={video.playlistUrl}
          poster={video.posterUrl}
          resumeAt={video.resumeAtSeconds}
        />
      ) : (
        <div className="grid aspect-video place-items-center rounded-[var(--radius-card)] bg-[#1D2233] text-center text-[#C9CCD6]">
          <p>
            {video.status === "FAILED"
              ? "This video couldn't be processed. Your teacher has been notified."
              : "This recording is still processing. Check back in a few minutes."}
          </p>
        </div>
      )}
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">{video.title}</h1>
      </header>
    </div>
  );
}
