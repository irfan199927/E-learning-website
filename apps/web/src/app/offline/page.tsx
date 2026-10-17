import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

/** Shown by the service worker (public/sw.js) when a page can't load. Static: no data, no scripts needed. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span
        className="grid size-16 place-items-center rounded-2xl bg-primary font-display text-3xl font-bold text-white"
        aria-hidden="true"
      >
        E
      </span>
      <h1 className="font-display text-2xl font-bold">You&apos;re offline</h1>
      <p className="text-muted">
        E-learner needs an internet connection. Check your Wi-Fi or mobile data, then try again.
      </p>
      <a
        href="/dashboard"
        className="inline-flex h-11 items-center rounded-[var(--radius-control)] bg-primary px-5 font-semibold text-white"
      >
        Try again
      </a>
    </main>
  );
}
