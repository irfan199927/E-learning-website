import type { Metadata } from "next";
import { LandingView, landingMetadata } from "./landing-view";

export const metadata: Metadata = landingMetadata;

/**
 * Static-export route (STATIC_SITE=1 builds only *.site.tsx routes; see next.config.ts).
 * No server here, so links come from build-time config: with SITE_APP_URL set (the deployed app),
 * Enroll and Sign in go to its sign-in page; without it they go to the "enrolment opens soon" page.
 */
const app = process.env.SITE_APP_URL?.replace(/\/+$/, "");

export default function StaticLandingPage() {
  return (
    <LandingView
      enroll={{ href: app ? `${app}/sign-in?next=%2Fcourses` : "/enroll/", label: "Enroll now" }}
      signInHref={app ? `${app}/sign-in` : "/enroll/"}
    />
  );
}
