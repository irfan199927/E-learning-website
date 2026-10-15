"use client";

import { joinWindow } from "@elearner/core/time";
import { useEffect, useState } from "react";
import { buttonClasses } from "./ui/button";

/**
 * Shows "Join" from N minutes before start. The server re-checks the window on click
 * (/api/v1/classes/:id/join), so this is UX only — never the security boundary.
 */
export function JoinButton({
  classId,
  startsAt,
  endsAt,
  opensMinutesBefore = 10,
}: {
  classId: string;
  startsAt: string;
  endsAt: string;
  opensMinutesBefore?: number;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;

  const w = joinWindow(new Date(startsAt), new Date(endsAt), now, opensMinutesBefore);
  if (w.state === "ended") return <span className="text-sm text-muted">Ended</span>;
  if (w.state === "not-yet") {
    const mins = Math.ceil((w.opensAt.getTime() - now.getTime()) / 60_000);
    const label =
      mins > 90
        ? `Opens ${w.opensAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : `Opens in ${mins} min`;
    return (
      <button type="button" disabled className={buttonClasses("secondary")}>
        {label}
      </button>
    );
  }
  return (
    <a
      href={`/api/v1/classes/${classId}/join`}
      target="_blank"
      rel="noopener"
      className={buttonClasses("live")}
    >
      <span className="size-2 rounded-full bg-white" aria-hidden="true" />
      Join class
    </a>
  );
}
