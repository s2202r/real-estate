import { appConfig } from "@/config/app";
import type { LegalDocument } from "@/components/legal/legal-page";

const app = appConfig.name;

export const disclaimerDocument: LegalDocument = {
  slug: "disclaimer",
  title: "Property Information Disclaimer",
  summary: "What our verification does and does not tell you about a property.",
  updated: "2026-08-31",
  sections: [
    {
      id: "what-verified-means",
      heading: "What “verified” means here",
      body: [
        {
          kind: "p",
          text: `A verified listing on ${app} is one an administrator has reviewed before publication. The review checks that the particulars are complete, that they are internally consistent, and that the documents the agent uploaded support what is claimed.`,
        },
        {
          kind: "callout",
          title: "It is not a title check",
          text: "Verification is not a legal opinion on ownership, title, encumbrance, litigation, approval or permission. It is not a survey, a structural report or a valuation. It does not make us a party to your transaction or a guarantor of it.",
        },
        {
          kind: "p",
          text: "Before you commit money, instruct your own advocate to examine title and your own surveyor to examine the building. Nothing on this platform substitutes for either.",
        },
      ],
    },
    {
      id: "badges",
      heading: "Agent badges",
      body: [
        {
          kind: "p",
          text: "Badges on an agent's profile are granted by us after review. No agent can award themselves one. A RERA badge records that we saw a registration number and checked it against the state register on the date shown; registrations lapse, and the badge is not a warranty that it is current today.",
        },
        {
          kind: "p",
          text: "Trust scores, response rates and conversion rates are internal measures used to route work. They are not published on an agent's profile, and they are not a recommendation.",
        },
      ],
    },
    {
      id: "accuracy",
      heading: "Accuracy, prices and availability",
      body: [
        {
          kind: "list",
          items: [
            "Prices are what the agent has published and are usually negotiable. They are not an offer capable of acceptance.",
            "Areas are as supplied. Carpet, built-up and super built-up are different measurements, and the platform records which is which — but the figure itself comes from the agent.",
            "Images may be of a similar unit in the same project. Where a listing says so, treat them as indicative.",
            "A property may be sold or let before a listing is taken down. Availability is confirmed by the agent, not by the page.",
            "Location markers may be approximate. Exact addresses are private until an enquiry is active.",
          ],
        },
      ],
    },
    {
      id: "third-party",
      heading: "Third-party content",
      body: [
        {
          kind: "p",
          text: "Virtual tours, videos and reels are hosted by third parties and embedded from an allowlist of services. Their content is theirs, governed by their terms, and we do not control it. Maps and location scores come from third-party data and are indicative.",
        },
      ],
    },
    {
      id: "financial",
      heading: "No financial or investment advice",
      body: [
        {
          kind: "p",
          text: "Nothing on this platform is investment, tax or legal advice, and no figure shown is a forecast or a promise of return. Property values fall as well as rise.",
        },
      ],
    },
  ],
};
