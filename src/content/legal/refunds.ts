import { appConfig, legalEntityDetails } from "@/config/app";
import type { LegalDocument } from "@/components/legal/legal-page";

const app = appConfig.name;

export const refundsDocument: LegalDocument = {
  slug: "refunds",
  title: "Payments, Cancellations and Refunds",
  summary: `What you pay ${app} for, and what happens when something is cancelled.`,
  updated: "2026-08-31",
  sections: [
    {
      id: "free",
      heading: "What is free",
      body: [
        {
          kind: "p",
          text: "Searching, saving properties, posting a requirement, enquiring and booking a site visit cost a customer nothing. We do not charge customers to be introduced to a property or to an agent.",
        },
      ],
    },
    {
      id: "charges",
      heading: "What is charged",
      body: [
        {
          kind: "p",
          text: "Charges arise on the network side of the platform: the platform's share of commission on a closed transaction, and any subscription or listing product an agent has expressly bought. The rate that applies to a transaction comes from the commission rule in force at the time, which is published, versioned and inspectable.",
        },
        {
          kind: "p",
          text: "All amounts are in Indian rupees. Taxes are added where they apply and are shown before you pay.",
        },
      ],
    },
    {
      id: "cancellations",
      heading: "Cancelling a visit or an enquiry",
      body: [
        {
          kind: "p",
          text: "You can cancel a site visit from your dashboard at no cost. Please cancel as early as you can — an agent may be travelling across a city for it. Repeated late cancellation may cost you access to visit booking.",
        },
      ],
    },
    {
      id: "refunds",
      heading: "Refunds",
      body: [
        {
          kind: "numbered",
          items: [
            "If you are charged in error — a duplicate charge, a charge for something you did not buy — tell us and we will refund it in full.",
            "If a paid service is not delivered because of a failure on our side, we refund the amount attributable to it.",
            "Commission on a transaction that does not complete is not payable. Where it has been collected and the transaction then falls through, it is reversed as a ledger entry and returned.",
            "A subscription cancelled part-way through a period runs to the end of that period. We do not refund the unused part unless the law requires it.",
          ],
        },
        {
          kind: "p",
          text: "Approved refunds are made to the original payment method within 7 to 10 working days of approval. How quickly it appears after that is up to your bank.",
        },
      ],
    },
    {
      id: "how-to-ask",
      heading: "How to ask for a refund",
      body: [
        {
          kind: "p",
          text: `Write to ${appConfig.supportEmail} with the transaction reference and what went wrong, within 30 days of the charge. We acknowledge within 48 hours and decide within 15 days. If we decline, we say why, and you can escalate through the Grievance Redressal process.`,
        },
      ],
    },
    {
      id: "chargebacks",
      heading: "Disputed card payments",
      body: [
        {
          kind: "p",
          text: "Please come to us before raising a chargeback — it is almost always faster. Where a chargeback is raised, we may suspend the related account until it is resolved.",
        },
      ],
    },
    {
      id: "no-investment",
      heading: "What we do not do",
      body: [
        {
          kind: "p",
          text: `${legalEntityDetails.name} is not a bank, a non-banking financial company, or a payment system operator. We do not accept deposits, offer investment products, or promise a return. Any money we route in connection with a transaction, we route as an intermediary.`,
        },
      ],
    },
  ],
};
