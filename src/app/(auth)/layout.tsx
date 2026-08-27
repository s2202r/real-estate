import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { appConfig } from "@/config/app";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label={`${appConfig.name} home`}>
            <Logo size={32} />
          </Link>
        </div>
      </header>
      <main id="main" className="surface-gradient flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}
