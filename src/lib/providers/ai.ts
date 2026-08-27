import "server-only";

import { getServerEnv } from "@/config/env";

/**
 * AI provider abstraction.
 *
 * Two rules govern everything here:
 *
 *  1. AI NEVER decides money. It drafts listing copy (which an agent must
 *     approve before publication) and parses natural-language search into
 *     structured filters. Commission and attribution are deterministic code.
 *  2. The platform must work with NO AI provider configured. The default is
 *     `RuleBasedProvider`, a deterministic implementation with no API key, no
 *     network call and no vendor lock-in. A hosted model is an upgrade, not a
 *     dependency.
 */

export interface ListingDraftRequest {
  readonly propertyType: string;
  readonly bedrooms?: number | null;
  readonly bathrooms?: number | null;
  readonly area?: number | null;
  readonly locality: string;
  readonly city: string;
  readonly price: string;
  readonly listingType: "SALE" | "RENT" | "LEASE";
  readonly furnishing?: string | null;
  readonly amenities?: readonly string[];
  readonly nearbyHighlights?: readonly string[];
  readonly freeText?: string;
}

export interface ListingDraft {
  readonly title: string;
  readonly description: string;
  readonly highlights: readonly string[];
  readonly seoDescription: string;
  readonly whatsappMessage: string;
  readonly socialCaption: string;
  /** Which provider produced this. Shown to the agent before they approve it. */
  readonly generatedBy: string;
  /** Always true: an agent must approve AI copy before it is published. */
  readonly requiresApproval: true;
}

export interface ParsedSearchQuery {
  readonly city?: string;
  readonly localities?: readonly string[];
  readonly propertyTypes?: readonly string[];
  readonly listingType?: "SALE" | "RENT" | "LEASE";
  readonly bedroomsMin?: number;
  readonly bedroomsMax?: number;
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly amenities?: readonly string[];
  readonly nearMetro?: boolean;
  readonly readyToMove?: boolean;
  readonly verifiedOnly?: boolean;
  /** Rendered as "Here's what I understood..." before the search runs. */
  readonly interpretation: string;
  readonly confidence: number;
}

export interface AiProvider {
  readonly name: string;
  isConfigured(): boolean;
  draftListing(request: ListingDraftRequest): Promise<ListingDraft>;
  parseSearchQuery(query: string): Promise<ParsedSearchQuery>;
}

/* ------------------------------------------------------------------------ *
 * Rule-based default
 * ------------------------------------------------------------------------ */

const INDIAN_NUMBER_WORDS: Record<string, number> = {
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
  lacs: 100_000,
  l: 100_000,
  crore: 10_000_000,
  crores: 10_000_000,
  cr: 10_000_000,
  k: 1_000,
  thousand: 1_000,
};

export class RuleBasedAiProvider implements AiProvider {
  readonly name = "rules";

  isConfigured(): boolean {
    return true;
  }

  async draftListing(request: ListingDraftRequest): Promise<ListingDraft> {
    const type = humanise(request.propertyType);
    const bhk = request.bedrooms ? `${request.bedrooms} BHK ` : "";
    const areaText = request.area ? `${request.area} sq ft ` : "";
    const action = request.listingType === "SALE" ? "for sale" : "on rent";

    const title = `${bhk}${type} ${action} in ${request.locality}, ${request.city}`.trim();

    const highlights = [
      request.area ? `${request.area} sq ft ${type.toLowerCase()}` : null,
      request.bedrooms ? `${request.bedrooms} bedrooms, ${request.bathrooms ?? request.bedrooms} bathrooms` : null,
      request.furnishing ? humanise(request.furnishing) : null,
      ...(request.nearbyHighlights ?? []).slice(0, 3),
      ...(request.amenities ?? []).slice(0, 3).map(humanise),
    ].filter((value): value is string => Boolean(value));

    const description = [
      `${bhk}${areaText}${type.toLowerCase()} available ${action} in ${request.locality}, ${request.city}.`,
      request.furnishing ? `The unit is ${humanise(request.furnishing).toLowerCase()}.` : "",
      (request.amenities?.length ?? 0) > 0
        ? `Society amenities include ${(request.amenities ?? []).slice(0, 5).map(humanise).join(", ").toLowerCase()}.`
        : "",
      (request.nearbyHighlights?.length ?? 0) > 0
        ? `Conveniently located near ${(request.nearbyHighlights ?? []).slice(0, 3).join(", ")}.`
        : "",
      request.freeText ?? "",
      "This property is listed on a verified inventory network and carries a permanent property passport.",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      title: title.slice(0, 160),
      description,
      highlights: highlights.slice(0, 6),
      seoDescription: `${title}. ${request.area ? `${request.area} sq ft. ` : ""}Verified listing with complete property details.`.slice(0, 160),
      whatsappMessage: `*${title}*\n\n${highlights.slice(0, 4).map((h) => `• ${h}`).join("\n")}\n\nInterested? Reply to arrange a site visit.`,
      socialCaption: `${title}\n\n${highlights.slice(0, 3).map((h) => `✓ ${h}`).join("\n")}`,
      generatedBy: this.name,
      requiresApproval: true,
    };
  }

  async parseSearchQuery(query: string): Promise<ParsedSearchQuery> {
    const text = query.toLowerCase();
    const understood: string[] = [];

    const listingType = /\b(rent|rental|lease|renting)\b/.test(text)
      ? ("RENT" as const)
      : ("SALE" as const);
    understood.push(listingType === "RENT" ? "for rent" : "for sale");

    const bedroomMatch = /(\d+)\s*(?:bhk|bedroom|bed)\b/.exec(text);
    const bedroomsMin = bedroomMatch ? Number(bedroomMatch[1]) : undefined;
    if (bedroomsMin) understood.push(`${bedroomsMin} BHK`);

    const priceMax = extractAmount(text, /(?:under|below|upto|up to|less than|within|max)\s+/);
    const priceMin = extractAmount(text, /(?:above|over|more than|starting|min|from)\s+/);
    if (priceMax) understood.push(`budget up to ${formatIndian(priceMax)}`);
    if (priceMin) understood.push(`budget from ${formatIndian(priceMin)}`);

    const propertyTypes: string[] = [];
    if (/\bapartment|flat\b/.test(text)) propertyTypes.push("APARTMENT");
    if (/\bvilla\b/.test(text)) propertyTypes.push("VILLA");
    if (/\bplot|land\b/.test(text)) propertyTypes.push("PLOT");
    if (/\bbuilder floor\b/.test(text)) propertyTypes.push("BUILDER_FLOOR");
    if (/\boffice\b/.test(text)) propertyTypes.push("OFFICE");
    if (/\bshop|retail\b/.test(text)) propertyTypes.push("SHOP");
    if (propertyTypes.length > 0) {
      understood.push(propertyTypes.map((t) => humanise(t).toLowerCase()).join(" or "));
    }

    const city = detectCity(text);
    if (city) understood.push(`in ${city}`);

    const localities = detectLocalities(query);
    if (localities.length > 0) understood.push(`around ${localities.join(", ")}`);

    const nearMetro = /\b(near|close to|walking distance)\b[^.]*\bmetro\b/.test(text);
    if (nearMetro) understood.push("close to a metro station");

    const readyToMove = /\bready to move|ready-to-move|immediate possession\b/.test(text);
    if (readyToMove) understood.push("ready to move");

    const amenities: string[] = [];
    if (/\bgym\b/.test(text)) amenities.push("gym");
    if (/\bpool|swimming\b/.test(text)) amenities.push("swimming_pool");
    if (/\bparking\b/.test(text)) amenities.push("covered_parking");
    if (/\bschool/.test(text)) understood.push("good schools nearby");

    // Confidence reflects how many signals we actually extracted, so the UI can
    // ask for confirmation instead of silently running a bad search.
    const signals = [city, bedroomsMin, priceMax, propertyTypes.length > 0].filter(Boolean).length;
    const confidence = Math.min(0.95, 0.35 + signals * 0.15);

    return {
      city: city ?? undefined,
      localities: localities.length > 0 ? localities : undefined,
      propertyTypes: propertyTypes.length > 0 ? propertyTypes : undefined,
      listingType,
      bedroomsMin,
      priceMin,
      priceMax,
      amenities: amenities.length > 0 ? amenities : undefined,
      nearMetro: nearMetro || undefined,
      readyToMove: readyToMove || undefined,
      verifiedOnly: true,
      interpretation: understood.length > 0 ? understood.join(", ") : "all verified listings",
      confidence,
    };
  }
}

/* ------------------------------------------------------------------------ *
 * Hosted providers
 * ------------------------------------------------------------------------ */

/**
 * Placeholder for a hosted LLM provider.
 *
 * It deliberately DELEGATES to the rule-based provider rather than throwing:
 * an unconfigured or failing model must degrade to a working product, never
 * break listing creation. Wire up the real call here.
 */
class HostedAiProvider implements AiProvider {
  private readonly fallback = new RuleBasedAiProvider();

  constructor(
    readonly name: string,
    private readonly apiKey: string | undefined,
    private readonly model: string | undefined,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.model);
  }

  async draftListing(request: ListingDraftRequest): Promise<ListingDraft> {
    if (!this.isConfigured()) return this.fallback.draftListing(request);
    const draft = await this.fallback.draftListing(request);
    return { ...draft, generatedBy: `${this.name} (not yet implemented; rule-based output)` };
  }

  async parseSearchQuery(query: string): Promise<ParsedSearchQuery> {
    return this.fallback.parseSearchQuery(query);
  }
}

let cachedProvider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cachedProvider) return cachedProvider;
  const env = getServerEnv();

  cachedProvider =
    env.AI_PROVIDER === "rules"
      ? new RuleBasedAiProvider()
      : new HostedAiProvider(env.AI_PROVIDER, env.AI_PROVIDER_API_KEY, env.AI_MODEL);

  return cachedProvider;
}

/* ------------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------------ */

function extractAmount(text: string, prefix: RegExp): number | undefined {
  const pattern = new RegExp(
    `${prefix.source}(?:₹|rs\\.?|inr)?\\s*(\\d+(?:\\.\\d+)?)\\s*(lakhs?|lacs?|crores?|cr|l|k|thousand)?`,
    "i",
  );
  const match = pattern.exec(text);
  if (!match?.[1]) return undefined;

  const value = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const multiplier = unit ? (INDIAN_NUMBER_WORDS[unit] ?? 1) : 1;
  return Math.round(value * multiplier);
}

const KNOWN_CITIES = [
  "noida extension", "greater noida", "noida", "ghaziabad", "gurgaon", "gurugram",
  "delhi", "faridabad", "lucknow", "bengaluru", "bangalore", "mumbai", "thane",
  "navi mumbai", "pune", "hyderabad", "chennai",
];

const CITY_ALIASES: Record<string, string> = {
  gurugram: "Gurgaon",
  bangalore: "Bengaluru",
  "noida extension": "Greater Noida",
};

function detectCity(text: string): string | null {
  for (const city of KNOWN_CITIES) {
    if (text.includes(city)) {
      return CITY_ALIASES[city] ?? titleCase(city);
    }
  }
  return null;
}

function detectLocalities(query: string): string[] {
  const localities: string[] = [];
  const sectorMatches = query.matchAll(/sector\s*(\d+[a-z]?)/gi);
  for (const match of sectorMatches) localities.push(`Sector ${match[1]}`);
  if (/noida extension/i.test(query)) localities.push("Noida Extension");
  if (/whitefield/i.test(query)) localities.push("Whitefield");
  if (/powai/i.test(query)) localities.push("Powai");
  if (/gomti nagar/i.test(query)) localities.push("Gomti Nagar");
  if (/sohna road/i.test(query)) localities.push("Sohna Road");
  if (/indirapuram/i.test(query)) localities.push("Indirapuram");
  return [...new Set(localities)];
}

function humanise(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatIndian(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2).replace(/\.?0+$/, "")} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}
