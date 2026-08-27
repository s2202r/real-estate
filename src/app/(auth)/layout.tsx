import Link from "next/link";
import { Building2 } from "lucide-react";
import { appConfig } from "@/config/app";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-4" aria-hidden />
            </span>
            <span className="tracking-tight">{appConfig.name}</span>
          </Link>
        </div>
      </header>
      <main id="main" className="surface-gradient flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}
