/**
 * Free-text search terms.
 *
 * Pure, so the tokenising rules are testable without a database.
 *
 * The problem this solves: a search box invites a sentence — "3BHK in Noida
 * Extension under 1.5 Cr" — but a listing title reads "3 BHK Apartment in
 * Sector 137, Noida". Matching the sentence as one substring finds nothing,
 * which reads to the user as "search is broken". Splitting it into terms that
 * each have to appear somewhere finds the right rows.
 *
 * Noise is dropped rather than ANDed in: because every term must match, one
 * term that cannot appear in any title ("under", "1.5", "cr") would empty the
 * result set on its own.
 */

/** Words that carry no matching signal in a property search. */
const STOP_WORDS = new Set([
  "a", "an", "and", "the", "or", "of", "to", "for", "with", "my", "me", "i",
  "in", "at", "on", "near", "nearby", "around", "close",
  "under", "below", "above", "over", "upto", "up", "within", "between",
  "less", "more", "than", "max", "maximum", "min", "minimum",
  "budget", "price", "cost", "rs", "inr", "rupees",
  "lakh", "lakhs", "lac", "lacs", "crore", "crores", "cr",
  "sq", "sqft", "ft", "feet", "yards", "yard",
  "property", "properties", "looking", "want", "need", "buy", "rent", "sale",
  "available", "please", "show",
]);

/** Terms must be at least this long to be worth an index scan. */
const MIN_TERM_LENGTH = 2;

/** Bounded, so a pasted paragraph cannot build an enormous query. */
const MAX_TERMS = 5;

/**
 * Split a query into the terms worth matching.
 *
 * Characters that are syntax inside a PostgREST filter — commas, parentheses,
 * dots, quotes — are stripped rather than escaped: a term containing one is
 * never a real place or project name, and leaving them in would let a crafted
 * query alter the filter expression.
 */
export function searchTerms(query: string): string[] {
  const cleaned = query
    .toLowerCase()
    // "3bhk" carries two signals; the digit is handled by structured filters
    // and dropped below, leaving "bhk".
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/[^a-z0-9\s-]/g, " ");

  const seen = new Set<string>();
  const terms: string[] = [];

  for (const raw of cleaned.split(/\s+/)) {
    const term = raw.replace(/^-+|-+$/g, "");
    if (term.length < MIN_TERM_LENGTH) continue;
    if (STOP_WORDS.has(term)) continue;
    // A bare number is a price, an area or a floor — all of which are
    // structured filters, and none of which belong in a title match.
    if (/^\d+$/.test(term)) continue;
    if (seen.has(term)) continue;

    seen.add(term);
    terms.push(term);
    if (terms.length >= MAX_TERMS) break;
  }

  return terms;
}

/**
 * Does the query say anything about renting?
 *
 * The query parser defaults `listingType` to SALE when nothing indicates
 * otherwise. Applying that default to a search would silently hide every
 * rental from someone who typed "flats in Noida", so the caller uses this to
 * apply the parsed type ONLY when the text actually expressed one.
 */
export function statesListingType(query: string): boolean {
  return /\b(rent|rental|renting|lease|leasing|let|sale|buy|buying|purchase|resale)\b/i.test(query);
}
