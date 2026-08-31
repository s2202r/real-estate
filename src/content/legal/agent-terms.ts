import { appConfig } from "@/config/app";
import type { LegalDocument } from "@/components/legal/legal-page";

const app = appConfig.name;

export const agentTermsDocument: LegalDocument = {
  slug: "agent-terms",
  title: "Agent and Partner Terms",
  summary: `The additional terms for agents, visiting agents, sales agents and partners on ${app}.`,
  updated: "2026-08-31",
  sections: [
    {
      id: "relationship",
      heading: "Our relationship",
      body: [
        {
          kind: "p",
          text: `You are an independent business. Nothing here makes you our employee, our partner in law, or our agent, and nothing makes us yours. You decide how you work, what you charge your own clients where that is separate from platform commission, and who else you work for.`,
        },
        {
          kind: "p",
          text: "You are responsible for your own registrations, licences, taxes and insurance. That includes registration as a real-estate agent where your state requires it before you may facilitate a transaction.",
        },
      ],
    },
    {
      id: "verification",
      heading: "Verification and badges",
      body: [
        {
          kind: "p",
          text: "Badges are granted by the platform after review of the documents you submit. You cannot award yourself one, and holding yourself out as verified when you are not is a breach of these terms serious enough to end your membership.",
        },
        {
          kind: "p",
          text: "Tell us promptly if a registration you relied on lapses, is suspended or is cancelled. We may re-verify at any time and may withdraw a badge if the basis for it no longer holds.",
        },
      ],
    },
    {
      id: "inventory",
      heading: "Listings and shared inventory",
      body: [
        {
          kind: "list",
          items: [
            "Only list what you are authorised by the owner to market, and be able to show that authority if we ask.",
            "Keep listings current. Withdraw a property that is sold, let or off the market.",
            "Do not post the same property twice to gain prominence. Duplicates are detected and adjudicated by a person, and repeated duplication costs you standing.",
            "Where another agent shares inventory with you, you may market it on the terms of that share and no further.",
            "Every listing is reviewed before publication. Rejection comes with a reason, and you may correct and resubmit.",
          ],
        },
      ],
    },
    {
      id: "customers",
      heading: "Customers and their details",
      body: [
        {
          kind: "p",
          text: "A customer's contact details are revealed to you against an active enquiry, within a daily limit, and every reveal is logged and shown to that customer. Use them for that enquiry and nothing else.",
        },
        {
          kind: "callout",
          title: "Explicitly prohibited",
          text: "Exporting or copying customer details out of the platform, adding them to a marketing list, passing them to anyone else, or contacting a customer about anything other than their enquiry. This is a breach of these terms and, separately, of data-protection law for which you are liable in your own right.",
        },
      ],
    },
    {
      id: "visits",
      heading: "Site visits",
      body: [
        {
          kind: "list",
          items: [
            "Accept a visit only if you can attend it. Repeated cancellations and no-shows reduce your standing and can cost you access to the visit pool.",
            "Check in at the property. Check-in is geofenced because attendance is what commission is attributed on.",
            "A visit counts as completed when the customer confirms it. You cannot confirm your own.",
            "Conduct yourself professionally and lawfully at a visit, and follow the owner's reasonable instructions about the premises.",
          ],
        },
      ],
    },
    {
      id: "commission",
      heading: "How you are paid",
      body: [
        {
          kind: "p",
          text: "Commission is calculated by a deterministic engine from published, versioned rules, and each calculation stores the exact policy version it applied. You can inspect the arithmetic behind any entry attributed to you. No part of it is decided by a model, and no percentage is hard-coded in the software.",
        },
        {
          kind: "p",
          text: "Attribution follows the recorded facts: who held the listing, who took the qualified visits the customer confirmed, who introduced the customer, and who closed. A dispute about attribution goes through the platform's dispute process.",
        },
        {
          kind: "list",
          items: [
            "An entry that has been paid is never rewritten. Corrections are made as reversal and adjustment entries.",
            "We may withhold payment on an entry that is under dispute or under investigation, and we will tell you why.",
            "GST, income tax and TDS are your responsibility. We deduct tax at source where the law requires it and give you the certificate.",
            "Changes to commission rules are published as a new version and apply to deals closing afterwards. Anything already calculated keeps the terms it was calculated under.",
          ],
        },
      ],
    },
    {
      id: "standing",
      heading: "Standing, suspension and leaving",
      body: [
        {
          kind: "p",
          text: "We measure response rate, visit completion, cancellations, complaints and closed deals. These are internal and are used to route work — they are not published on your public profile.",
        },
        {
          kind: "p",
          text: "We may suspend you for a breach of these terms, for a pattern of complaints, or where we are investigating something serious. A suspension always comes with a reason, recorded and sent to you, because you cannot answer an allegation you have not been told. Suspension removes you from the public directory; your existing listings are dealt with separately, since customers may be mid-enquiry.",
        },
        {
          kind: "p",
          text: "You may leave at any time. Commission already earned on closed deals remains payable. Obligations about customer data survive your leaving.",
        },
      ],
    },
    {
      id: "indemnity",
      heading: "Responsibility for what you publish",
      body: [
        {
          kind: "p",
          text: "You are responsible for the accuracy of what you publish and for holding the rights to the images and video you upload. If a claim is brought against us because of something you published without authority or in breach of these terms, you will indemnify us against it.",
        },
      ],
    },
  ],
};
