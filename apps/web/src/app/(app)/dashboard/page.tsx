import { formatInZone } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinButton } from "@/components/join-button";
import { buttonClasses } from "@/components/ui/button";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { listClasses } from "@/server/services/classes";
import { isGoogleConnected } from "@/server/services/courses";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const actor = await requirePageActor();
  const d = deps();
  const now = d.now();
  const [classes, googleOk] = await Promise.all([
    listClasses(d, actor, {
      from: new Date(now.getTime() - 3 * 3600_000),
      to: new Date(now.getTime() + 7 * 86_400_000),
    }),
    actor.role === "TEACHER" ? isGoogleConnected(d, actor.id) : Promise.resolve(true),
  ]);
  const upcoming = classes.filter((c) => new Date(c.endsAt) > now).slice(0, 8);
  const greeting = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: actor.timezone,
  }).format(now);
  const hour = Number(greeting);
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  return (
    <div className="flex max-w-5xl flex-col gap-7">
      <header>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Good {part}, {actor.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted">
          {upcoming.length
            ? `${upcoming.length} upcoming classes this week`
            : "No classes in the next 7 days"}
        </p>
      </header>

      {!googleOk && (
        <section
          className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5"
          aria-label="Google connection"
        >
          <p className="flex-1">
            <b>Connect Google</b> to schedule classes with Meet links and get recordings automatically.
          </p>
          <a href="/api/v1/google/connect?returnTo=/dashboard" className={buttonClasses("primary")}>
            Connect Google
          </a>
        </section>
      )}

      <section
        className="rounded-[var(--radius-card)] border border-line bg-surface p-6"
        aria-labelledby="upcoming-h"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="upcoming-h" className="font-display text-xl font-bold">
            Upcoming classes
          </h2>
          <Link href="/calendar" className="text-sm font-semibold text-primary">
            Calendar
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="py-6 text-muted">
            {actor.role === "TEACHER"
              ? "Nothing scheduled. Schedule your first class from the Calendar."
              : "You're all caught up."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {upcoming.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-4 py-3">
                <span
                  className="w-1.5 self-stretch rounded-full"
                  style={{ background: c.course.color }}
                  aria-hidden="true"
                />
                <span className="flex min-w-48 flex-1 flex-col">
                  <b className="text-[15px]">{c.title}</b>
                  <span className="text-sm text-muted">
                    {c.course.title} · {formatInZone(new Date(c.startsAt), actor.timezone)}
                  </span>
                </span>
                {actor.role !== "PARENT" && (
                  <JoinButton classId={c.id} startsAt={c.startsAt} endsAt={c.endsAt} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
