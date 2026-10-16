"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/**
 * Fades and lifts its content in the first time it scrolls into view. Children with a `--i`
 * style stagger by that index. CSS hides content only when scripting is on and motion is allowed
 * (landing.css), so no-JS and reduced-motion visitors always see everything.
 */
export function Reveal({
  as: Tag = "div",
  className = "",
  stagger = false,
  children,
}: {
  as?: ElementType;
  className?: string;
  /** Animate each child in turn (by its `--i`) instead of the block as a whole. */
  stagger?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset.shown = "";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} data-reveal="" data-stagger={stagger ? "" : undefined} className={className}>
      {children}
    </Tag>
  );
}
