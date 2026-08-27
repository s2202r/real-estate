"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Pagination.
 *
 * Keeps the page number in the URL so a result page is linkable and the back
 * button behaves. Window of five page buttons, so the control does not grow
 * unbounded on a large result set.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Paging replaces the list in place rather than unmounting the route, so
  // `loading.tsx` never runs and nothing would otherwise change on screen
  // between the click and the new page arriving.
  const [isPending, startTransition] = useTransition();

  if (totalPages <= 1) return null;

  const goTo = (target: number) => {
    const next = new URLSearchParams(searchParams.toString());
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const windowEnd = Math.min(totalPages, windowStart + 4);
  const pages = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      className="mt-10 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row"
      aria-label="Pagination"
      aria-busy={isPending}
    >
      <p className="tabular flex items-center gap-2 text-sm text-muted-foreground">
        {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        Showing {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of{" "}
        {total.toLocaleString("en-IN")}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1 || isPending}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden />
        </Button>

        {pages.map((item) => (
          <Button
            key={item}
            variant={item === page ? "default" : "outline"}
            size="sm"
            onClick={() => goTo(item)}
            disabled={isPending}
            aria-current={item === page ? "page" : undefined}
            className="tabular min-w-9"
          >
            {item}
          </Button>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages || isPending}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
