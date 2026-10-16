"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A code editor that types itself once it scrolls into view, then "runs" the program.
 * The animated copy is aria-hidden; screen readers get the full program and output at once.
 * Reduced motion: shows the finished program immediately.
 */
export function TypingTerminal({ file, code, output }: { file: string; code: string; output: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(code.length);
  const [ran, setRan] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShown(0);
    setRan(false);
    let timer = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        let n = 0;
        const tick = () => {
          // Type whole runs of indentation at once; a human doesn't press space eight times.
          n = Math.min(code.length, n + (code[n] === " " ? code.slice(n).search(/\S|$/) || 1 : 1));
          setShown(n);
          if (n < code.length) timer = window.setTimeout(tick, code[n - 1] === "\n" ? 140 : 28);
          else timer = window.setTimeout(() => setRan(true), 450);
        };
        timer = window.setTimeout(tick, 300);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [code]);

  return (
    <div ref={ref} className="lp-terminal">
      <div className="lp-terminal-bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <b>{file}</b>
      </div>
      <pre className="sr-only">{`${code}\n\nOutput:\n${output}`}</pre>
      <pre className="lp-terminal-code" aria-hidden="true">
        {code.slice(0, shown)}
        {shown < code.length && <i className="lp-caret" />}
      </pre>
      <div className="lp-terminal-out" data-ran={ran ? "" : undefined} aria-hidden="true">
        <span className="lp-prompt">$ python {file}</span>
        <span>{output}</span>
      </div>
    </div>
  );
}
