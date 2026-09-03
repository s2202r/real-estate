"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A spinner inside the link that was clicked.
 *
 * The global bar says "a page is loading". This says "the page YOU clicked is
 * loading" — which is the difference between someone waiting and someone
 * clicking a second time on a different item because they are not sure the
 * first one registered.
 *
 * Must be rendered as a descendant of a `<Link>`; `useLinkStatus` reads that
 * link's pending state and returns `{ pending: false }` anywhere else.
 *
 * ALWAYS RENDERED, never conditionally: a spinner that appears would reflow
 * the row it sits in, and a navigation item that jumps as you click it is
 * worse than no feedback at all. It occupies its space and changes opacity.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();

  return (
    <Loader2
      aria-hidden
      className={cn(
        "size-3.5 shrink-0 transition-opacity duration-150",
        pending ? "animate-spin opacity-70" : "opacity-0",
        className,
      )}
    />
  );
}
