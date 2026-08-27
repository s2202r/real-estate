import { FilterRailSkeleton, PropertyGridSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-6 lg:px-8 lg:pb-10">
      <header className="mb-8 space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </header>
      <Skeleton className="mb-6 h-12 w-full rounded-lg" />
      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <FilterRailSkeleton />
        <PropertyGridSkeleton />
      </div>
    </div>
  );
}
