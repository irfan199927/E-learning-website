import { formatInZone, RECORDING_NOTICE } from "@elearner/core";
import type { Metadata } from "next";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getRecordingConsent } from "@/server/services/recording-consent";
import { ConsentButtons } from "./consent-buttons";

export const metadata: Metadata = { title: "Class recordings" };

const STATUS = {
  agreed: null,
  outdated:
    "The notice has changed since you last agreed. Please read it and agree again to keep joining live classes.",
  withdrawn: "You withdrew your agreement, so you can't join live classes from E-learner.",
  none: "You haven't answered yet. You need to agree before you can join live classes.",
} as const;

export default async function RecordingConsentPage() {
  const actor = await requirePageActor(["STUDENT"]);
  const consent = await getRecordingConsent(deps(), actor);
  const message = STATUS[consent.status];
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <p className="text-sm font-semibold text-muted">Class recordings</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{RECORDING_NOTICE.title}</h1>
      </header>
      <section
        aria-labelledby="notice-h"
        className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5"
      >
        <h2 id="notice-h" className="sr-only">
          Recording notice
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {RECORDING_NOTICE.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">Notice version {consent.version}.</p>
        <p className="font-semibold">
          {consent.agreedAt ? `You agreed on ${formatInZone(consent.agreedAt, actor.timezone)}.` : message}
        </p>
        <ConsentButtons agreed={consent.status === "agreed"} version={consent.version} />
      </section>
    </div>
  );
}
