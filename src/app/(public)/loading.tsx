import { PageHeaderSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for the marketing pages that have no skeleton of their own.
 * Search, detail and directory routes override this with a closer match.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-14 sm:px-6 lg:px-8">
      <PageHeaderSkeleton />
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className={i % 3 === 2 ? "h-4 w-2/3" : "h-4 w-full"} />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
