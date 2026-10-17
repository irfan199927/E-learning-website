import Link from "next/link";
import { Icon } from "@/components/icons";
import { ProgressRing } from "@/components/progress-ring";
import type { MonthActivity } from "@/server/services/learning";

/**
 * A learner's "Today's progress" ring and "Monthly progress" calendar. Used on the student Overview and on a
 * parent's view of their child.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const card = "rounded-[var(--radius-card)] border border-line bg-surface";

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-3 font-display text-xl font-bold">
      {children}
    </h2>
  );
}

export function TodayProgress({
  seconds,
  goalMinutes,
  questions,
  lessonsCompleted,
  coursesInProgress,
}: {
  seconds: number;
  /** The school's daily watch goal (Admin → Settings). */
  goalMinutes: number;
  /** Quiz questions answered today. */
  questions: number;
  lessonsCompleted: number;
  coursesInProgress: number;
}) {
  const minutes = Math.floor(seconds / 60);
  return (
    <section aria-labelledby="today-h" className="flex flex-col">
      <SectionTitle id="today-h">Today&apos;s progress</SectionTitle>
      <div className={`flex flex-1 flex-wrap items-center justify-around gap-6 p-6 ${card}`}>
        <ProgressRing
          value={(minutes / goalMinutes) * 100}
          size={132}
          stroke={12}
          color="var(--color-primary)"
          label={`${minutes} of ${goalMinutes} minutes watched today`}
        >
          <span className="flex flex-col">
            <b className="text-2xl">{minutes}</b>
            <span className="text-xs text-muted">
              of {goalMinutes} min
              <br />
              watched
            </span>
          </span>
        </ProgressRing>
        <dl className="flex flex-col gap-4">
          <div>
            <dt className="text-xs text-muted">Questions answered</dt>
            <dd className="text-2xl font-bold">{questions}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Lessons completed</dt>
            <dd className="text-2xl font-bold">{lessonsCompleted}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Courses in progress</dt>
            <dd className="text-2xl font-bold">{coursesInProgress}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function MonthlyProgress({ month, basePath }: { month: MonthActivity; basePath: string }) {
  const navLink =
    "grid size-9 place-items-center rounded-full text-ink hover:bg-canvas aria-disabled:pointer-events-none aria-disabled:opacity-30";
  return (
    <section aria-labelledby="month-h" className="flex flex-col">
      <SectionTitle id="month-h">Monthly progress</SectionTitle>
      <div className={`flex-1 p-5 ${card}`}>
        <div className="mb-3 flex items-center justify-center gap-4">
          <Link href={`${basePath}?month=${month.prev}`} className={navLink} aria-label="Previous month">
            <Icon name="chevronLeft" size={18} />
          </Link>
          <p className="min-w-36 text-center font-bold" aria-live="polite">
            {month.label}
          </p>
          {month.next ? (
            <Link href={`${basePath}?month=${month.next}`} className={navLink} aria-label="Next month">
              <Icon name="chevronRight" size={18} />
            </Link>
          ) : (
            <span className={navLink} aria-disabled="true" aria-hidden="true">
              <Icon name="chevronRight" size={18} />
            </span>
          )}
        </div>
        <table className="w-full table-fixed text-center">
          <caption className="sr-only">
            Days with lesson time in {month.label}: {month.activeDays}
          </caption>
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w} scope="col" className="pb-2 text-[11px] font-semibold uppercase text-muted">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {month.weeks.map((week, i) => (
              <tr key={i}>
                {week.map((c, j) => (
                  <td key={j} className="p-0.5">
                    {c && (
                      <span
                        className={`mx-auto grid size-8 place-items-center rounded-full text-xs ${
                          c.seconds > 0
                            ? "bg-success font-bold text-white"
                            : c.isFuture
                              ? "text-muted/50"
                              : "border border-dashed border-line-strong text-muted"
                        } ${c.isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : ""}`}
                      >
                        {c.day}
                        <span className="sr-only">
                          {c.isToday ? " (today)" : ""}
                          {c.seconds > 0 ? `: ${Math.max(1, Math.round(c.seconds / 60))} min watched` : ""}
                        </span>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-center text-xs text-muted">
          {month.activeDays} {month.activeDays === 1 ? "day" : "days"} of learning this month
        </p>
      </div>
    </section>
  );
}
