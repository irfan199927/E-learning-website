import { formatInZone, isAppError } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getAssignment, type SubmissionView } from "@/server/services/assignments";
import { GradeForm } from "./grade-form";
import { SubmitForm } from "./submit-form";

export const metadata: Metadata = { title: "Assignment" };

const card = "rounded-[var(--radius-card)] border border-line bg-surface p-5";
const pill = "rounded-full px-2 py-0.5 text-xs font-semibold";

function StatusPill({ s }: { s: SubmissionView | null }) {
  if (!s) return <span className={`${pill} bg-canvas text-muted`}>Not handed in</span>;
  if (s.status === "GRADED") return <span className={`${pill} bg-success-soft text-[#0C6447]`}>Graded</span>;
  if (s.status === "LATE")
    return <span className={`${pill} bg-live-soft text-[#A11C14]`}>Handed in late</span>;
  return <span className={`${pill} bg-primary-soft text-primary-fg-strong`}>Handed in</span>;
}

function Files({ s }: { s: SubmissionView }) {
  if (s.files.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {s.files.map((f) => (
        <li key={f.index}>
          <a
            href={`/api/v1/submissions/${s.id}/files/${f.index}`}
            className="flex items-center gap-2 text-sm font-semibold text-primary-fg hover:underline"
          >
            <Icon name="file" size={16} className="shrink-0" />
            {f.name}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function AssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const actor = await requirePageActor(["STUDENT", "TEACHER", "ADMIN"]);
  const { assignmentId } = await params;
  const view = await getAssignment(deps(), actor, assignmentId).catch((err) => {
    if (isAppError(err) && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  });
  const a = view.assignment;
  const due = formatInZone(a.dueAt, actor.timezone);
  const mine = view.mine;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link
        href={`/courses/${a.courseId}#assignments`}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        {a.courseTitle}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">Assignment{a.published ? "" : " · Draft"}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{a.title}</h1>
          <p className="mt-1 text-muted">
            Due {due} · {a.maxPoints} points
            {a.allowLate ? " · late work accepted" : ""}
          </p>
        </div>
        {view.canManage && (
          <Link href={`/assignments/${a.id}/edit`} className={buttonClasses("secondary")}>
            <Icon name="edit" size={18} />
            Edit
          </Link>
        )}
      </header>

      <section aria-labelledby="instructions-h" className={card}>
        <h2 id="instructions-h" className="mb-2 font-display text-xl font-bold">
          Instructions
        </h2>
        <Markdown>{a.instructions}</Markdown>
      </section>

      {!view.canManage && (
        <section aria-labelledby="work-h" className={card}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 id="work-h" className="font-display text-xl font-bold">
              Your work
            </h2>
            <StatusPill s={mine} />
          </div>
          {mine?.status === "GRADED" ? (
            <div className="flex flex-col gap-3">
              <p className="text-2xl font-bold">
                {mine.score}/{a.maxPoints}
              </p>
              {mine.feedback && (
                <blockquote className="border-l-4 border-primary pl-3 whitespace-pre-line">
                  {mine.feedback}
                </blockquote>
              )}
              {mine.text && (
                <div className="whitespace-pre-line rounded-[var(--radius-control)] bg-canvas p-3">
                  {mine.text}
                </div>
              )}
              <Files s={mine} />
            </div>
          ) : view.timing === "closed" ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted">
                The due date has passed and this assignment doesn&apos;t take late work.
              </p>
              {mine && <Files s={mine} />}
            </div>
          ) : (
            <>
              {view.timing === "late" && (
                <p className="mb-3 text-sm text-[#A11C14]">
                  The due date has passed. What you hand in now is marked late.
                </p>
              )}
              {mine?.submittedAt && (
                <p className="mb-3 text-sm text-muted">
                  Handed in {formatInZone(mine.submittedAt, actor.timezone)}. You can change it until
                  it&apos;s graded.
                </p>
              )}
              <SubmitForm
                assignmentId={a.id}
                allowText={a.allowText}
                allowFile={a.allowFile}
                initialText={mine?.text ?? ""}
                initialFiles={(mine?.files ?? []).flatMap((f) =>
                  f.key ? [{ key: f.key, name: f.name }] : [],
                )}
                again={!!mine}
              />
            </>
          )}
        </section>
      )}

      {view.roster && (
        <section aria-labelledby="subs-h" className={card}>
          <h2 id="subs-h" className="font-display text-xl font-bold">
            Students ({view.roster.length})
          </h2>
          <p className="mb-3 text-sm text-muted">
            {view.roster.filter((r) => r.submission).length} handed in ·{" "}
            {view.roster.filter((r) => r.submission?.status === "GRADED").length} graded
          </p>
          {view.roster.length === 0 ? (
            <p className="text-muted">No students in this course yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {view.roster.map((r) => (
                <li key={r.userId} className="flex flex-col gap-3 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{r.name}</p>
                    <StatusPill s={r.submission} />
                    {r.submission?.submittedAt && (
                      <span className="text-sm text-muted">
                        {formatInZone(r.submission.submittedAt, actor.timezone)}
                      </span>
                    )}
                  </div>
                  {r.submission && (
                    <>
                      {r.submission.text && (
                        <details className="rounded-[var(--radius-control)] bg-canvas p-3">
                          <summary className="cursor-pointer text-sm font-semibold">Written answer</summary>
                          <div className="mt-2 whitespace-pre-line">{r.submission.text}</div>
                        </details>
                      )}
                      <Files s={r.submission} />
                      <GradeForm
                        submissionId={r.submission.id}
                        studentName={r.name}
                        maxPoints={a.maxPoints}
                        score={r.submission.score}
                        feedback={r.submission.feedback}
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
