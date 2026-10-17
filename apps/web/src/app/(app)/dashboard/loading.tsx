import { Bone, PageSkeleton, SkeletonCard } from "@/components/skeleton";

/** Overview: the resume card, then progress cards side by side. */
export default function Loading() {
  return (
    <PageSkeleton>
      <Bone className="h-40 w-full rounded-[var(--radius-card)]" />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </PageSkeleton>
  );
}
