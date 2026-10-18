"use client";

import { useEffect, useState, type ReactNode } from "react";
import GlyphPortal from "@/components/ui/glyph-portal";

const WORD = "CODE";
const FALLBACK = '"Arial Black", Arial, sans-serif';
/** Both themes: heavy sans (product-launch style), self-hosted. Kept per mode so a theme could differ again. */
const FACES = {
  light: { variable: "--font-figtree", weight: 900 },
  dark: { variable: "--font-figtree", weight: 900 },
} as const;
type Mode = keyof typeof FACES;

function currentMode(): Mode {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Landing hero: scrolling flies the camera through the word CODE into the course.
 * GlyphPortal measures the letters once at mount, so we wait for the theme's self-hosted face
 * (next/font, no third-party font request) before mounting, and re-mount when the theme changes.
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
  const [mode, setMode] = useState<Mode | null>(null);
  const [face, setFace] = useState<{ family: string; weight: number } | null>(null);

  // Follow the theme: the toggle sets <html data-theme>; without it, the OS setting.
  useEffect(() => {
    const update = () => setMode(currentMode());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!mode) return;
    const { variable, weight } = FACES[mode];
    let settled = false;
    const finish = (family: string) => {
      if (!settled) {
        settled = true;
        setFace({ family, weight });
      }
    };
    const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    if (!family) {
      finish(FALLBACK);
      return;
    }
    const timeout = window.setTimeout(() => finish(FALLBACK), 1600);
    document.fonts.load(`${weight} 100px ${family}`, WORD).then(
      () => finish(`${family}, ${FALLBACK}`),
      () => finish(FALLBACK),
    );
    return () => {
      settled = true;
      window.clearTimeout(timeout);
    };
  }, [mode]);

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
      key={face.family}
      word={WORD}
      fontFamily={face.family}
      fontWeight={face.weight}
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
