"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";

export interface MobileNavLink {
  readonly href: string;
  readonly label: string;
}

/**
 * The mobile menu: a panel that slides in from the right.
 *
 * This is a client component for one reason — it has to close itself. App
 * Router navigation does not unmount the layout, so a menu that only opened
 * would stay open on top of the page the visitor just navigated to. Every
 * entry therefore closes the sheet as it navigates.
 */
export function MobileNav({
  links,
  accountHref,
  accountLabel,
  signedIn,
}: {
  links: readonly MobileNavLink[];
  accountHref: string;
  accountLabel: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" aria-label="Menu">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Logo size={26} />
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1" aria-label="Mobile">
          {links.map((link) => (
            <Button key={link.href} asChild variant="ghost" className="h-11 justify-start text-base">
              <Link href={link.href} onClick={close}>
                {link.label}
              </Link>
            </Button>
          ))}
        </nav>

        <Button asChild className="mt-2 h-11 w-full">
          <Link href={accountHref} onClick={close}>
            {!signedIn && <LogIn aria-hidden />}
            {accountLabel}
          </Link>
        </Button>

        {!signedIn && (
          <Button asChild variant="outline" className="h-11 w-full">
            <Link href="/register" onClick={close}>
              Create an account
            </Link>
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
