import { AgentGridSkeleton, FilterRailSkeleton, PageHeaderSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-6 lg:px-8 lg:pb-14">
      <PageHeaderSkeleton className="max-w-3xl" />
      <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <FilterRailSkeleton />
        <AgentGridSkeleton />
      </div>
    </div>
  );
}
