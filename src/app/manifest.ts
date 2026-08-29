import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app";
import { BRAND_COLORS } from "@/components/brand/logo";

/**
 * PWA manifest.
 *
 * `start_url` points at the public search rather than the marketing home page:
 * someone who installs a property app wants inventory, not a pitch.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${appConfig.name} — ${appConfig.tagline}`,
    short_name: appConfig.name,
    description: appConfig.description,
    start_url: "/properties",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: BRAND_COLORS.solid,
    lang: appConfig.locale,
    categories: ["business", "lifestyle", "shopping"],
    // A 192 and a 512 PNG are what an installable manifest must carry; the
    // maskable variant keeps the glyph inside the safe zone so Android can
    // crop it to whatever shape the launcher uses without clipping the roof.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Search properties", url: "/properties", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "My dashboard", url: "/dashboard", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Site visits", url: "/dashboard/visits", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
    prefer_related_applications: false,
  };
}
