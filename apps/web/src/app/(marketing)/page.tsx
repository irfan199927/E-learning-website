import type { Metadata } from "next";
import { getActor } from "@/lib/session";
import { LandingView, landingMetadata } from "./landing-view";

export const metadata: Metadata = landingMetadata;

/** App route: every enrol path goes through sign-in; afterwards students land on their courses. */
export default async function LandingPage() {
  const actor = await getActor();
  return (
    <LandingView
      enroll={actor ? null : { href: "/sign-in?next=%2Fcourses", label: "Enroll now" }}
      signInHref="/sign-in"
    />
  );
}
