import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getConsentState } from "@/server/services/consent";
import { DateOfBirthForm } from "./date-of-birth-form";

export const metadata: Metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

/** First sign-in for students: ask the date of birth once (decides whether a parent's consent is needed). */
export default async function WelcomePage() {
  const actor = await requirePageActor(["STUDENT"]);
  if ((await getConsentState(deps(), actor.id)).kind !== "needs-dob") redirect("/dashboard");
  return (
    <>
      <h1 className="mb-1 font-display text-2xl font-bold">Welcome, {actor.name.split(" ")[0]}</h1>
      <p className="mb-6 text-sm text-muted">
        One question before you start. If you&apos;re under 18, we&apos;ll ask a parent or guardian to approve
        your account, as the law requires.
      </p>
      <DateOfBirthForm />
    </>
  );
}
