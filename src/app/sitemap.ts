import type { MetadataRoute } from "next";
import { appConfig, supportedCities } from "@/config/app";
import { searchListings } from "@/lib/data/listings";
import { searchAgents } from "@/lib/data/agents";
import { listingPath } from "@/lib/domain/references";

/**
 * Sitemap.
 *
 * Only pages that should be indexed appear: verified listings, public agent
 * profiles, location pages and marketing pages. Dashboards, auth pages and
 * anything containing customer data are excluded by construction — they are
 * never enumerated here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appConfig.url;

  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/properties`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/agents`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const cityEntries: MetadataRoute.Sitemap = supportedCities.map((city) => ({
    url: `${base}/locations/${city.slug}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Cap the crawl surface: a sitemap is a hint, not an archive.
  const [listingResult, agentResult] = await Promise.all([
    searchListings({ pageSize: 1000, sort: "newest" }),
    searchAgents({ pageSize: 48 }),
  ]);

  const listingEntries: MetadataRoute.Sitemap = listingResult.listings.map((listing) => ({
    url: `${base}${listingPath({
      locality: listing.locality,
      slug: listing.slug,
      reference: listing.referenceCode,
    })}`,
    lastModified: listing.publishedAt ? new Date(listing.publishedAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const agentEntries: MetadataRoute.Sitemap = agentResult.agents.map((agent) => ({
    url: `${base}/agent/${agent.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...cityEntries, ...listingEntries, ...agentEntries];
}
