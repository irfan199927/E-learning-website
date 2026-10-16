"use client";

import { useEffect, useState, type ReactNode } from "react";
import GlyphPortal from "@/components/ui/glyph-portal";

const WORD = "CODE";
const WEIGHT = 800;
const FALLBACK = '"Arial Black", Arial, sans-serif';

/**
 * Landing hero: scrolling flies the camera through the word CODE into the course.
 * GlyphPortal measures the letters once at mount, so we wait for our self-hosted mono face
 * (next/font, no third-party font request) before mounting, with a short fallback timeout.
 */
export function HeroPortal({
  eyebrow,
  support,
  actions,
  children,
}: {
  eyebrow: string;
  support: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  const [face, setFace] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;
    const finish = (value: string) => {
      if (!settled) {
        settled = true;
        setFace(value);
      }
    };
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains").trim();
    if (!family) {
      finish(FALLBACK);
      return;
    }
    const timeout = window.setTimeout(() => finish(FALLBACK), 1600);
    document.fonts.load(`${WEIGHT} 100px ${family}`, WORD).then(
      () => finish(`${family}, ${FALLBACK}`),
      () => finish(FALLBACK),
    );
    return () => {
      settled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  if (!face) {
    // Same height as the portal's first frame, so nothing jumps when it mounts.
    return (
      <div className="lp-hero-placeholder" role="status">
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <GlyphPortal
      word={WORD}
      fontFamily={face}
      fontWeight={WEIGHT}
      scrollLength={2.2}
      interactive
      enterLabel="Step inside the course"
      className="lp-portal"
      style={{
        "--gp-paper": "var(--lp-bg)",
        "--gp-ink": "var(--lp-fg)",
        "--gp-field": "var(--lp-field)",
        "--gp-foreground": "var(--lp-fg)",
        fontFamily: "var(--font-sans)",
      }}
      background={<CodeField />}
      front={
        <>
          <p className="lp-eyebrow">
            <span className="lp-live-dot" aria-hidden="true" />
            {eyebrow}
          </p>
          <div className="lp-support">
            <p>{support}</p>
            <div className="lp-hero-actions">{actions}</div>
          </div>
        </>
      }
    >
      {children}
    </GlyphPortal>
  );
}

const SNIPPET = `function greet(name) {
  return \`Hello, \${name}!\`;
}
for (const day of week) {
  if (practised(day)) streak++;
}
def solve(puzzle):
    return sorted(puzzle)[0]
<section class="hero">
  <h1>I built this.</h1>
</section>
git commit -m "first app"`;

/** Decorative scene seen through the letters: a gradient with faint code. */
function CodeField() {
  return (
    <div className="lp-field">
      <pre className="lp-field-code">{Array.from({ length: 6 }, () => SNIPPET).join("\n")}</pre>
    </div>
  );
}
