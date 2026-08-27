import { redirect } from "next/navigation";

/**
 * Placeholder route.
 *
 * The investor module ships behind ENABLE_INVESTOR_MODULE (default false)
 * pending the legal review in docs/LEGAL_REVIEW.md item L1. Until the
 * contractual structure is signed off there is nothing here worth building
 * beyond the overview, so these routes redirect rather than presenting an
 * empty shell that implies functionality exists.
 */
export default function ExclusivePage() {
  redirect("/investor/dashboard");
}
