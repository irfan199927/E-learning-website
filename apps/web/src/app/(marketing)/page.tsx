import type { Metadata } from "next";
import Link from "next/link";
import { HeroPortal } from "@/components/landing/hero-portal";
import { Reveal } from "@/components/landing/reveal";
import { SiteHeader } from "@/components/landing/site-header";
import { TypingTerminal } from "@/components/landing/typing-terminal";
import { getActor } from "@/lib/session";
import { course } from "./course";
import "./landing.css";

export const metadata: Metadata = {
  title: { absolute: `${course.name}: learn to code, live · E-learner` },
  description: course.pitch,
  // The app itself is noindex (root layout); the public course page is meant to be found.
  robots: { index: true, follow: true },
};

const PROGRAM = `streak = 0
week = ["Mon", "Wed", "Fri"]

for day in week:
    print(f"{day}: coded today")
    streak += 1

print(f"Streak: {streak} days. Keep going!")`;

const OUTPUT = `Mon: coded today
Wed: coded today
Fri: coded today
Streak: 3 days. Keep going!`;

export default async function LandingPage() {
  const actor = await getActor();
  // Every enrol path goes through sign-in; afterwards students land on their courses.
  const enroll = actor ? null : { href: "/sign-in?next=%2Fcourses", label: "Enroll now" };
  const primary = enroll ?? { href: "/dashboard", label: "Go to dashboard" };

  return (
    <div className="lp">
      <a href="#main" className="lp-skip">
        Skip to content
      </a>
      <SiteHeader cta={enroll} />

      <main id="main">
        <HeroPortal
          eyebrow={course.audience}
          support={course.tagline}
          actions={
            <>
              <Link href={primary.href} className="lp-btn lp-btn-primary">
                {primary.label}
                <Arrow />
              </Link>
              <a href="#curriculum" className="lp-btn lp-btn-ghost">
                See the curriculum
              </a>
            </>
          }
        >
          <div className="lp-inside">
            <p className="lp-kicker">Inside {course.name}</p>
            <h2 className="lp-h2">A teacher, a live class and your own code, three times a week.</h2>
            <ol className="lp-steps">
              {course.steps.map((s, i) => (
                <li key={s.title}>
                  <span className="lp-step-no" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </HeroPortal>

        <section className="lp-section lp-intro" aria-labelledby="intro-h">
          <Reveal className="lp-intro-copy">
            <h1 id="intro-h" className="lp-h1">
              {course.name}
              <span>{course.tagline}</span>
            </h1>
            <p className="lp-lead">{course.pitch}</p>
          </Reveal>
          <Reveal as="dl" stagger className="lp-facts">
            {course.facts.map((f, i) => (
              <div key={f.label} style={{ "--i": i } as React.CSSProperties}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </Reveal>
          <div className="lp-marquee" aria-label="Technologies you'll learn">
            <ul>
              {course.tech.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <ul aria-hidden="true">
              {course.tech.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-section lp-split" aria-labelledby="code-h">
          <Reveal className="lp-split-copy">
            <p className="lp-kicker">Day one</p>
            <h2 id="code-h" className="lp-h2">
              You write real code in the first class.
            </h2>
            <p className="lp-lead">
              No weeks of theory first. You type, run, break and fix programs from the start, and your teacher
              explains what happened.
            </p>
            <ul className="lp-checks">
              <li>Code in the browser: nothing to install</li>
              <li>Ask questions live, in every class</li>
              <li>Rewatch any class from your library</li>
            </ul>
          </Reveal>
          <TypingTerminal file="streak.py" code={PROGRAM} output={OUTPUT} />
        </section>

        <section id="curriculum" className="lp-section" aria-labelledby="curriculum-h">
          <Reveal className="lp-section-head">
            <p className="lp-kicker">Curriculum</p>
            <h2 id="curriculum-h" className="lp-h2">
              Twelve weeks, four milestones.
            </h2>
          </Reveal>
          <ol className="lp-timeline">
            {course.modules.map((m, i) => (
              <Reveal as="li" key={m.title} className="lp-module">
                <span className="lp-module-no" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="lp-module-weeks">{m.weeks}</p>
                  <h3>{m.title}</h3>
                  <p className="lp-muted">{m.summary}</p>
                  <ul className="lp-tags">
                    {m.topics.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        <section id="projects" className="lp-section" aria-labelledby="projects-h">
          <Reveal className="lp-section-head">
            <p className="lp-kicker">Projects</p>
            <h2 id="projects-h" className="lp-h2">
              Six things you&apos;ll build and keep.
            </h2>
          </Reveal>
          <Reveal as="ul" stagger className="lp-cards">
            {course.projects.map((p, i) => (
              <li key={p.title} className="lp-card" style={{ "--i": i } as React.CSSProperties}>
                <span className="lp-card-tech">{p.tech}</span>
                <h3>{p.title}</h3>
                <p>{p.blurb}</p>
              </li>
            ))}
          </Reveal>
        </section>

        <section className="lp-section" aria-labelledby="batch-h">
          <Reveal className="lp-batch">
            <div>
              <p className="lp-kicker">Next batch</p>
              <h2 id="batch-h" className="lp-h2">
                Starts {course.batch.starts}
              </h2>
              <p className="lp-price">{course.batch.price}</p>
            </div>
            <dl className="lp-batch-facts">
              <div>
                <dt>Schedule</dt>
                <dd>{course.batch.schedule}</dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>{course.batch.mode}</dd>
              </div>
              <div>
                <dt>Class size</dt>
                <dd>{course.batch.seats}</dd>
              </div>
            </dl>
            <Link href={primary.href} className="lp-btn lp-btn-primary lp-btn-lg">
              {enroll ? "Reserve your seat" : primary.label}
              <Arrow />
            </Link>
          </Reveal>
        </section>

        <section id="faq" className="lp-section lp-faq" aria-labelledby="faq-h">
          <Reveal className="lp-section-head">
            <p className="lp-kicker">Questions</p>
            <h2 id="faq-h" className="lp-h2">
              Good to know.
            </h2>
          </Reveal>
          <div className="lp-faq-list">
            {course.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-section lp-final" aria-labelledby="final-h">
          <Reveal>
            <h2 id="final-h" className="lp-h2">
              Your first program is three classes away.
            </h2>
            <Link href={primary.href} className="lp-btn lp-btn-primary lp-btn-lg">
              {primary.label}
              <Arrow />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="lp-footer">
        <span>© 2026 E-learner</span>
        <Link href="/sign-in">Sign in</Link>
      </footer>
    </div>
  );
}

function Arrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="lp-arrow"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
