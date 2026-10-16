"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/** Fixed header: transparent over the hero, solid once the page scrolls. Always offers the CTA. */
export function SiteHeader({ cta }: { cta: { href: string; label: string } | null }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (window.scrollY > 24) el.dataset.scrolled = "";
      else delete el.dataset.scrolled;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header ref={ref} className="lp-header">
      <Link href="/" className="lp-logo" aria-label="E-learner home">
        <span className="lp-logo-mark" aria-hidden="true">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 6l-6 6 6 6M16 6l6 6-6 6" />
          </svg>
        </span>
        E-learner
      </Link>
      <nav aria-label="Page sections" className="lp-nav">
        <a href="#curriculum">Curriculum</a>
        <a href="#projects">Projects</a>
        <a href="#faq">FAQ</a>
      </nav>
      <div className="lp-header-actions">
        {cta ? (
          <>
            <Link href="/sign-in" className="lp-link">
              Sign in
            </Link>
            <Link href={cta.href} className="lp-btn lp-btn-primary lp-btn-sm">
              {cta.label}
            </Link>
          </>
        ) : (
          <Link href="/dashboard" className="lp-btn lp-btn-primary lp-btn-sm">
            Go to dashboard
          </Link>
        )}
      </div>
    </header>
  );
}
