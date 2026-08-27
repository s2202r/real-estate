/**
 * Reference codes — the human-readable identities users actually quote.
 *
 * PROP-NCR-0001827   a Property Passport, permanent for the life of the property
 * LIST-NCR-000123    one agent's listing against that passport
 * DEAL-NCR-000456    a transaction
 * COMM-NET-000789    a ledger entry
 *
 * Codes are ALLOCATED IN THE DATABASE (see next_reference()), because only the
 * database can hand out a monotonic sequence safely under concurrency. This
 * module handles the pure parts: formatting, parsing and validation.
 */

export const REFERENCE_PREFIXES = {
  property: "PROP",
  listing: "LIST",
  requirement: "REQ",
  lead: "LEAD",
  visit: "VISIT",
  deal: "DEAL",
  commission: "COMM",
  payment: "PAY",
  dispute: "DSP",
  agreement: "AGR",
  opportunity: "OPP",
} as const;

export type ReferenceKind = keyof typeof REFERENCE_PREFIXES;

export interface ParsedReference {
  readonly kind: ReferenceKind | null;
  readonly prefix: string;
  readonly scope: string;
  readonly sequence: number;
}

const REFERENCE_PATTERN = /^([A-Z]{3,6})-([A-Z]{2,4})-(\d{4,10})$/;

export function formatReference(prefix: string, scope: string, sequence: number, width = 6): string {
  return `${prefix}-${scope}-${String(sequence).padStart(width, "0")}`;
}

export function parseReference(reference: string): ParsedReference | null {
  const match = REFERENCE_PATTERN.exec(reference.trim().toUpperCase());
  if (!match) return null;

  const [, prefix = "", scope = "", digits = "0"] = match;
  const kind =
    (Object.entries(REFERENCE_PREFIXES).find(([, p]) => p === prefix)?.[0] as ReferenceKind) ?? null;

  return { kind, prefix, scope, sequence: Number(digits) };
}

export function isValidReference(reference: string, kind?: ReferenceKind): boolean {
  const parsed = parseReference(reference);
  if (!parsed) return false;
  return kind ? parsed.prefix === REFERENCE_PREFIXES[kind] : true;
}

/**
 * SEO-friendly listing path:
 *   /property/noida-extension/3bhk-apartment-sector-12/prop-123
 */
export function listingPath(input: {
  locality: string;
  slug: string;
  reference: string;
}): string {
  return `/property/${kebab(input.locality)}/${kebab(input.slug)}/${input.reference.toLowerCase()}`;
}

function kebab(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
