"use client";

import { Filter, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The chrome every filter panel shares: a desktop rail, and on smaller screens
 * a floating action button that opens the same controls in a sheet.
 *
 * Why a FAB rather than a control in the page header: on a phone the results
 * list is long, and an inline trigger scrolls away exactly when someone decides
 * to narrow the search. Pinning it keeps filtering one thumb-reach away at any
 * scroll position, and bottom-right is where the thumb already is on a
 * right-handed grip. It clears the iOS home indicator via the safe-area inset.
 *
 * Panels supply the controls; this supplies the frame, so /properties and
 * /agents cannot drift apart.
 */
export function FilterShell({
  activeCount,
  onReset,
  className,
  children,
}: {
  activeCount: number;
  onReset: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <aside className={cn("hidden lg:block", className)} aria-label="Filters">
        {children}
      </aside>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className={cn(
                "fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-30",
                "h-14 rounded-full pl-5 pr-6 shadow-lg shadow-primary/25",
                "transition-transform active:scale-95",
              )}
              aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"}
            >
              <Filter className="size-5" aria-hidden />
              <span className="text-base font-medium">Filters</span>
              {activeCount > 0 && (
                <span
                  className="tabular ml-0.5 flex size-6 items-center justify-center rounded-full bg-primary-foreground text-xs font-semibold text-primary"
                  aria-hidden
                >
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>

          <SheetContent side="right" className="w-[88%] max-w-md">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="flex-1">{children}</div>
            <SheetFooter>
              <Button variant="outline" onClick={onReset} className="h-11">
                <X aria-hidden />
                Clear all
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

export function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

export function CheckboxRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}

/** The "clear N filters" control, identical across panels. */
export function ClearFiltersButton({
  activeCount,
  onReset,
}: {
  activeCount: number;
  onReset: () => void;
}) {
  if (activeCount === 0) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onReset} className="w-full">
      <RotateCcw aria-hidden />
      Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
    </Button>
  );
}
