import type { LegalDocument } from "@/components/legal/legal-page";
import { termsDocument } from "./terms";
import { privacyDocument } from "./privacy";
import { cookiesDocument } from "./cookies";
import { agentTermsDocument } from "./agent-terms";
import { refundsDocument } from "./refunds";
import { grievanceDocument } from "./grievance";
import { disclaimerDocument } from "./disclaimer";
import { nriGuideDocument } from "./nri-guide";

/**
 * The legal documents, in the order they are listed on /legal.
 *
 * Ordered by who needs them: everyone, then customers, then the network.
 * Each is plain data so the renderer is the only thing that decides how a
 * policy looks, and amending one is a content change rather than a layout one.
 */
export const legalDocuments: readonly LegalDocument[] = [
  termsDocument,
  privacyDocument,
  cookiesDocument,
  disclaimerDocument,
  refundsDocument,
  agentTermsDocument,
  grievanceDocument,
  nriGuideDocument,
];

export function legalDocument(slug: string): LegalDocument | undefined {
  return legalDocuments.find((document) => document.slug === slug);
}

export {
  termsDocument,
  privacyDocument,
  cookiesDocument,
  agentTermsDocument,
  refundsDocument,
  grievanceDocument,
  disclaimerDocument,
  nriGuideDocument,
};
