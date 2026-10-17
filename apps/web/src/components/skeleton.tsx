import { getTranslations } from "next-intl/server";

/** A grey placeholder block. Pulses unless the person prefers reduced motion. */
export function Bone({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-line motion-safe:animate-pulse ${className}`} aria-hidden="true" />;
}

const card = "rounded-[var(--radius-card)] border border-line bg-surface p-5";

/** A card-shaped placeholder: a heading line and a few text lines. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className={card} aria-hidden="true">
      <Bone className="mb-4 h-6 w-2/5" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Bone key={i} className={`h-4 ${i === lines - 1 ? "w-3/5" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * Page placeholder shown while a signed-in page loads (route `loading.tsx` files). The shell stays put; screen
 * readers hear "Loading…" once.
 */
export async function PageSkeleton({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Shell");
  return (
    <div className="flex max-w-6xl flex-col gap-6" role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <Bone className="h-4 w-32" />
        <Bone className="h-9 w-72 max-w-full" />
      </div>
      {children}
    </div>
  );
}
