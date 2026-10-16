import { CONSENT_NOTICE_VERSION } from "@elearner/core";
import type { Metadata } from "next";
import { FormAlert } from "@/components/form";
import { deps } from "@/server/container";
import { viewConsentRequest } from "@/server/services/consent";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Parent or guardian consent", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Public page a parent opens from the consent email. The single-use token in the URL is the credential. */
export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await viewConsentRequest(deps(), token);

  if (view.status !== "open")
    return (
      <>
        <h1 className="mb-3 font-display text-2xl font-bold">Parent or guardian consent</h1>
        <FormAlert tone={view.status === "used" ? "success" : "error"}>
          {view.status === "used"
            ? `Consent for ${view.studentName} has already been given. Nothing else to do.`
            : view.status === "expired"
              ? `This link has expired. Ask ${view.studentName} to send you a new one from E-learner.`
              : "This link isn't valid. Check you opened the whole link from the email."}
        </FormAlert>
      </>
    );

  return (
    <>
      <h1 className="mb-1 font-display text-2xl font-bold">Approve {view.studentName}&apos;s account</h1>
      <p className="mb-5 text-sm text-muted">
        {view.studentName} gave {view.parentEmail} as their parent&apos;s or guardian&apos;s email. Because
        they are under 18, the school needs your consent before using their information.
      </p>
      <section
        aria-labelledby="notice-h"
        className="mb-5 rounded-[var(--radius-control)] bg-canvas p-4 text-sm"
      >
        <h2 id="notice-h" className="mb-2 font-semibold">
          What the school keeps, and why
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Their name, email address and date of birth, to run their account.</li>
          <li>
            Which lessons they watch, how far they get, and when they attend live classes, so teachers can
            follow their progress.
          </li>
          <li>
            Recordings of live classes they take part in, shown only to the students and teachers of that
            course.
          </li>
        </ul>
        <p className="mt-2">
          It is used only for their learning: never sold, never used for advertising, and no tracking tools
          are used. You can withdraw consent at any time by contacting the school, and ask for their data to
          be deleted.
        </p>
        <p className="mt-2 text-xs text-muted">Notice version {CONSENT_NOTICE_VERSION}</p>
      </section>
      <ConsentForm token={token} studentName={view.studentName!} />
    </>
  );
}
