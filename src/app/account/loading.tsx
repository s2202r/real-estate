import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level fallback for the shared account pages.
 *
 * The preferred answer to a slow navigation, per the Next.js guidance: the
 * shell appears immediately and the transition is instant, so nobody is left
 * looking at the previous page wondering whether the click landed.
 */
export default function Loading() {
  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="space-y-3 rounded-xl border p-6">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
    </div>
  );
}
