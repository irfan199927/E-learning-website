"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 700;

/**
 * A number that counts up from 0 when it first appears. The server renders the final value (no JS, no layout
 * shift: use `tabular-nums`), and people who turn motion off see it straight away.
 */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || value <= 1) return;
    started.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION_MS);
      // Ease out (decelerate into the final number).
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setShown(value);
    };
  }, [value]);

  return <>{shown}</>;
}
