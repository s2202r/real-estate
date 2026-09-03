import { Skeleton } from "@/components/ui/skeleton";

/** Route-level fallback for sign-in, registration and password reset. */
export default function Loading() {
  return (
    <div className="w-full max-w-md space-y-4 rounded-xl border p-6">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
