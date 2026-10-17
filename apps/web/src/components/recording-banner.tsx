"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { buttonClasses } from "./ui/button";

/** Asks a student to read the class-recording notice until they answer (not shown on the notice page itself). */
export function RecordingBanner({ outdated }: { outdated: boolean }) {
  if (usePathname() === "/recording-consent") return null;
  return (
    <aside
      aria-label="Class recordings"
      className="mb-6 flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-line bg-primary-soft p-4"
    >
      <Icon name="video" size={24} className="shrink-0 text-primary-fg-strong" />
      <p className="min-w-48 flex-1">
        <b>Live classes are recorded.</b>{" "}
        {outdated
          ? "The recording notice has changed. Read it and agree again to keep joining live classes."
          : "Read the recording notice and agree to it to join live classes."}
      </p>
      <Link href="/recording-consent" className={buttonClasses("primary")}>
        Read the notice
      </Link>
    </aside>
  );
}
