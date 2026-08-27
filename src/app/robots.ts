import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app";

/**
 * Robots policy.
 *
 * Authenticated areas are disallowed explicitly. They are already behind auth,
 * but keeping them out of the crawl budget also stops dashboard URLs appearing
 * in search results as login redirects.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/",
          "/agent/dashboard",
          "/agent/properties",
          "/agent/leads",
          "/agent/customers",
          "/agent/visits",
          "/agent/inventory",
          "/agent/commissions",
          "/agent/analytics",
          "/agent/profile",
          "/investor/",
          "/admin",
          "/admin/",
          "/login",
          "/register",
          "/auth/",
          "/unauthorized",
        ],
      },
    ],
    sitemap: `${appConfig.url}/sitemap.xml`,
    host: appConfig.url,
  };
}
