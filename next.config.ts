import type { NextConfig } from "next";
import { frameSrcValue } from "./src/config/embeds";

/**
 * Content Security Policy.
 *
 * `unsafe-inline` on style-src is required by Tailwind's runtime style
 * injection and by Next's inlined critical CSS. `unsafe-eval` is dev-only
 * (React Refresh). Everything else is locked to self plus the Supabase project
 * and the map provider.
 */
const isDev = process.env.NODE_ENV === "development";

const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "";
  } catch {
    return "";
  }
})();

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://maps.googleapis.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `img-src 'self' blob: data: https://images.unsplash.com https://maps.googleapis.com https://maps.gstatic.com${
    supabaseOrigin ? ` ${supabaseOrigin}` : ""
  }`,
  `media-src 'self' blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  `connect-src 'self' https://maps.googleapis.com${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseOrigin.replace("https://", "wss://")}` : ""}`,
  // Built from src/config/embeds.ts, which the gallery also checks against:
  // a frame the UI is willing to render must be one the policy allows.
  `frame-src ${frameSrcValue()}`,
  // The service worker and the manifest are same-origin; `default-src`
  // would already cover them, but a CSP that states its intent is easier
  // to review than one that relies on a fallback.
  `worker-src 'self'`,
  `manifest-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Geolocation is required for geofenced visit check-in.
            value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },

  // Never let a type error reach production. (Next 16 no longer runs ESLint
  // during `next build`; linting is a separate `npm run lint` step, wired into
  // `npm run verify` and CI.)
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
