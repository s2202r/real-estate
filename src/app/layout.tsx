import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { appConfig } from "@/config/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

/**
 * The brand typeface.
 *
 * `next/font` downloads and self-hosts the files at build time, so there is no
 * request to a font CDN at runtime, no third-party cookie, and no layout shift
 * — the metrics of the local fallback are adjusted to match. A variable weight
 * range means one file covers body text through display headings.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-brand",
});

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.url),
  title: {
    default: `${appConfig.name} — ${appConfig.tagline}`,
    template: `%s · ${appConfig.name}`,
  },
  description: appConfig.description,
  applicationName: appConfig.name,
  keywords: [
    "verified property listings",
    "real estate agents",
    "property visits",
    "property inventory network",
    "buy property India",
    "rent property India",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: appConfig.url,
    siteName: appConfig.name,
    title: `${appConfig.name} — ${appConfig.tagline}`,
    description: appConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${appConfig.name} — ${appConfig.tagline}`,
    description: appConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111a20" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={jakarta.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
