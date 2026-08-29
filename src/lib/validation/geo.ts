import { z } from "zod";
import { findCity, findState } from "@/data/india";

/**
 * City and state fields, canonicalised on the way in.
 *
 * The pickers offer a closed list, but a form post is not bound by what the
 * picker offered, and older rows were typed by hand. So a value that MATCHES a
 * known place is rewritten to that place's canonical spelling — "bangalore"
 * and "BENGALURU" both land as "Bengaluru" — and a value that matches nothing
 * is kept as typed.
 *
 * Kept rather than rejected on purpose: this list is curated, not exhaustive,
 * and an agent holding inventory in a town we happened to miss should not be
 * unable to list it. Comparability is worth having where we can get it; it is
 * not worth blocking someone's livelihood over.
 */
export const CityField = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .transform((value) => findCity(value)?.name ?? value);

export const StateField = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .transform((value) => findState(value)?.name ?? value);
