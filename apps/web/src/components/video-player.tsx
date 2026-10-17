"use client";

import type Hls from "hls.js";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const BEACON_MS = 15_000;

/**
 * HLS player with resume, speed control and progress beacons.
 * Safari plays HLS natively; other browsers load hls.js on demand (keeps the bundle small).
 */
export function VideoPlayer({
  videoId,
  src,
  poster,
  resumeAt,
}: {
  videoId: string;
  src: string;
  poster: string | null;
  resumeAt: number;
}) {
  const t = useTranslations("Lesson");
  const ref = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  // The message key, so the effect doesn't depend on `t`.
  const [error, setError] = useState<"unsupported" | "stopped" | null>(null);
  const watched = useRef(0);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | undefined;
    const seekToResume = () => {
      if (resumeAt > 5) video.currentTime = resumeAt;
    };

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", seekToResume, { once: true });
    } else {
      void import("hls.js").then(({ default: HlsCtor }) => {
        if (!HlsCtor.isSupported()) return setError("unsupported");
        hls = new HlsCtor({
          xhrSetup: (xhr, url) => {
            xhr.withCredentials = url.startsWith("/");
          },
        });
        hls.on(HlsCtor.Events.MANIFEST_PARSED, seekToResume);
        hls.on(HlsCtor.Events.ERROR, (_e, data) => {
          if (data.fatal) setError("stopped");
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      });
    }

    // Count only real watching time (not seeks) for progress/attendance analytics.
    const onTime = () => {
      const now = video.currentTime;
      if (lastTick.current !== null && now > lastTick.current && now - lastTick.current < 2)
        watched.current += now - lastTick.current;
      lastTick.current = now;
    };
    const send = (keepalive = false) => {
      const delta = Math.min(120, Math.round(watched.current));
      watched.current -= delta;
      void fetch(`/api/v1/videos/${videoId}/progress`, {
        method: "PUT",
        keepalive,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          positionSeconds: Math.floor(video.currentTime),
          watchedDeltaSeconds: delta,
          completed: video.ended || undefined,
        }),
      }).catch(() => undefined);
    };
    const interval = setInterval(() => !video.paused && send(), BEACON_MS);
    const onHide = () => send(true);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", () => send());
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", onHide);
      video.removeEventListener("timeupdate", onTime);
      send(true);
      hls?.destroy();
    };
  }, [videoId, src, resumeAt]);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
  }, [speed]);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-black">
        <video
          ref={ref}
          controls
          playsInline
          preload="metadata"
          poster={poster ?? undefined}
          className="aspect-video w-full"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-live">
          {t(error)}
        </p>
      )}
      <div role="group" aria-label={t("speedGroup")} className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{t("speed")}</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            onClick={() => setSpeed(s)}
            className={`h-11 min-w-11 rounded-[var(--radius-control)] border px-3 text-sm font-semibold ${speed === s ? "border-primary bg-primary-soft text-primary-fg-strong" : "border-line-strong bg-surface"}`}
          >
            {s}×
          </button>
        ))}
        {resumeAt > 5 && (
          <span className="ml-auto text-sm text-muted">{t("resumedAt", { time: formatTime(resumeAt) })}</span>
        )}
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}
