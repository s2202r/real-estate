import { DashboardSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <DashboardSkeleton />
    </div>
  );
}
