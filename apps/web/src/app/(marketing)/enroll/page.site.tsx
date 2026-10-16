import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/landing/site-header";
import { course } from "../course";
import "../landing.css";

export const metadata: Metadata = {
  title: { absolute: `Enrolment opens soon · ${course.name} · E-learner` },
  robots: { index: false, follow: true },
};

/**
 * Static site only: online sign-in isn't live yet, so enrol buttons land here.
 * Once the app is deployed, set SITE_APP_URL and they go straight to its sign-in page instead.
 */
export default function EnrollSoonPage() {
  return (
    <div className="lp">
      <SiteHeader cta={null} signInHref="/enroll/" hideActions />
      <main id="main" className="lp-section lp-soon">
        <p className="lp-kicker">{course.name}</p>
        <h1 className="lp-h2">Online enrolment opens soon.</h1>
        <p className="lp-lead">
          The next batch starts {course.batch.starts}. Until sign-up is live, ask your school office or class
          teacher to reserve a seat for you.
        </p>
        <Link href="/" className="lp-btn lp-btn-primary lp-btn-lg">
          Back to the course page
        </Link>
      </main>
    </div>
  );
}
