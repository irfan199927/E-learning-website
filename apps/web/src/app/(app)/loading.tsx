import { PageSkeleton, SkeletonCard } from "@/components/skeleton";

/** Any signed-in page: a title and a few cards while the server renders it. */
export default function Loading() {
  return (
    <PageSkeleton>
      <SkeletonCard lines={4} />
      <SkeletonCard />
    </PageSkeleton>
  );
}
