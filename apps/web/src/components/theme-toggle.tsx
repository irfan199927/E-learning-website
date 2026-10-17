"use client";

import { useEffect, useState } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

function effectiveTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Light/dark switch. Both icons are rendered and CSS shows the right one, so the server HTML matches
 * whatever theme the visitor ends up with (no hydration mismatch, no flash). The choice is stored in
 * a cookie that the root layout reads. Where supported, the new theme is revealed as a circle growing
 * from the button (View Transitions); with reduced motion it simply switches.
 * Labels come in as props: the static landing page has no translations (next-intl) to read them from.
 */
export function ThemeToggle({
  className = "",
  label = "Dark mode",
  title = "Switch between light and dark",
}: {
  className?: string;
  label?: string;
  title?: string;
}) {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    // The static export can't read the cookie on a server; apply a saved choice after load instead.
    const root = document.documentElement;
    if (!root.dataset.theme) {
      const saved = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)`))?.[1];
      if (saved) root.dataset.theme = saved;
    }
    setDark(effectiveTheme() === "dark");
  }, []);

  function apply(next: Theme) {
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setDark(next === "dark");
  }

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next: Theme = effectiveTheme() === "dark" ? "light" : "dark";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !document.startViewTransition) return apply(next);
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const root = document.documentElement;
    root.style.setProperty("--vt-x", `${left + width / 2}px`);
    root.style.setProperty("--vt-y", `${top + height / 2}px`);
    document.startViewTransition(() => apply(next));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={dark ?? undefined}
      title={title}
      className={`theme-toggle ${className}`}
    >
      <svg data-icon="sun" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </g>
      </svg>
      <svg data-icon="moon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z" />
      </svg>
    </button>
  );
}
