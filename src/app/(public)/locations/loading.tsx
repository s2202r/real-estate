import { PageHeaderSkeleton, PropertyGridSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <PageHeaderSkeleton className="max-w-3xl" />
      <PropertyGridSkeleton />
    </div>
  );
}
