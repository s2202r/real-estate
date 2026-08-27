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
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Search properties", url: "/properties" },
      { name: "My dashboard", url: "/dashboard" },
      { name: "Site visits", url: "/dashboard/visits" },
    ],
  };
}
