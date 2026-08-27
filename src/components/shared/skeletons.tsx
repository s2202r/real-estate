import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading skeletons.
 *
 * These exist to answer one question the visitor is asking: "did my click do
 * anything?" A page that stays completely still after a tap invites a second
 * tap, and a third. Next renders these the instant navigation starts, before
 * the server has produced anything, so the answer is immediate.
 *
 * They mirror the SHAPE of the page they stand in for — same grid, same card
 * proportions — so the real content does not visibly reflow when it arrives.
 */

export function PropertyCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-4 border-t pt-3">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
        <Skeleton className="mt-4 h-6 w-40" />
        <Skeleton className="mt-4 h-16 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function AgentGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <AgentCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function FilterRailSkeleton() {
  return (
    <div className="hidden space-y-6 lg:block" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden>
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <Skeleton className="h-4 w-2/3 max-w-md" />
    </div>
  );
}

/** Stat tiles above a dashboard table — the shape every workspace page opens with. */
export function DashboardSkeleton({ stats = 4, rows = 5 }: { stats?: number; rows?: number }) {
  return (
    <div className="space-y-8" aria-hidden>
      <PageHeaderSkeleton />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: stats }, (_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-8 w-20 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** A property or agent detail page: media block, then two columns. */
export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8" aria-hidden>
      <Skeleton className="h-4 w-64" />
      <Skeleton className="aspect-[16/9] w-full rounded-xl sm:aspect-[21/9]" />
      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <PageHeaderSkeleton />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}
