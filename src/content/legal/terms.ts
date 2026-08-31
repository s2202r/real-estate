import { appConfig, legalEntityDetails } from "@/config/app";
import { orGap, type LegalDocument } from "@/components/legal/legal-page";

const entity = appConfig.legalEntity;
const app = appConfig.name;

export const termsDocument: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  summary: `The agreement between you and ${entity} for your use of ${app}.`,
  updated: "2026-08-31",
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are, and what this agreement covers",
      body: [
        {
          kind: "p",
          text: `${app} is operated by ${entity}${
            legalEntityDetails.registrationNumber ? ` (${legalEntityDetails.registrationNumber})` : ""
          }, registered at ${orGap(legalEntityDetails.registeredAddress, "registered address")}. In these terms, "we" and "us" mean that company, and "you" means the person or business using the platform.`,
        },
        {
          kind: "p",
          text: "By creating an account, or by using the platform without one, you accept these terms. If you are accepting them for a business, you confirm you are authorised to bind it.",
        },
        {
          kind: "p",
          text: `Agents, visiting agents and sales agents are also bound by the Agent and Partner Terms, which sit alongside this agreement and prevail over it where the two differ on a matter specific to network membership.`,
        },
      ],
    },
    {
      id: "what-the-platform-is",
      heading: "What the platform is — and is not",
      body: [
        {
          kind: "p",
          text: `${app} is a network for verified property inventory. It lets property owners' agents publish listings, lets customers find and visit them, coordinates site visits between agents, and records how a transaction was introduced so that commission can be attributed.`,
        },
        {
          kind: "callout",
          title: "We are not a party to your transaction",
          text: "We do not own, sell, let or value property. We are not your broker, your conveyancer, your valuer or your financial adviser. A contract to buy, sell or rent is made between you and the other party to it, on terms you agree with them. We are not liable under it.",
        },
        {
          kind: "p",
          text: "We publish information provided by others. Our review of a listing checks that the information supplied is complete, internally consistent and supported by the documents the agent uploaded. It is not a legal opinion on title, ownership, encumbrance, permission or fitness, and it is not a survey. See the Property Information Disclaimer.",
        },
      ],
    },
    {
      id: "accounts",
      heading: "Your account",
      body: [
        {
          kind: "list",
          items: [
            "You must be at least 18 and legally able to enter a contract.",
            "The details you give us — name, email address, mobile number — must be true, and you must keep them current. We verify your email address before the account can be used.",
            "One person, one account. Do not share credentials. You are responsible for what is done through your account until you tell us it has been compromised.",
            "Administrator access is granted by us, never requested through the product. No sign-up path produces it.",
          ],
        },
        {
          kind: "p",
          text: "We may suspend or close an account that breaks these terms, that we reasonably believe is being used fraudulently, or that we are required to act against. Where we suspend an agent, we tell them the reason, because someone whose livelihood runs through this platform must be able to answer the allegation.",
        },
      ],
    },
    {
      id: "listings",
      heading: "Listings and property information",
      body: [
        {
          kind: "p",
          text: "Only an agent account may publish a listing, and no listing appears publicly until we have reviewed it. Where a listing is rejected, we give the reason so it can be corrected.",
        },
        {
          kind: "p",
          text: "If you publish a listing, you confirm that you are authorised by the owner to market the property, that the particulars are accurate, that any image or video you upload is yours to use, and that you hold whatever registration your state requires of a real-estate agent. You are responsible for the disclosures your state's RERA rules require in an advertisement.",
        },
        {
          kind: "p",
          text: "Each physical property has one permanent record on the platform, which several agents may hold listings against. That record persists after a listing ends: price history, visit history and verification history belong to the property, not to whoever last marketed it.",
        },
        {
          kind: "p",
          text: "We may edit a listing to correct an error, or take it down. Where we do, the change is recorded with its previous value and the agent is told.",
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
            "A visit must be requested with at least twelve hours' notice, so the agent taking it has fair warning.",
            "A visit is only recorded as completed when the customer confirms it. An agent cannot mark their own visit complete, because that is what commission is attributed on.",
            "Check-in may require your location, taken at the property and used to confirm attendance. It is not used to track you between visits.",
            "Repeated no-shows, by either side, may cost you access to visit booking.",
          ],
        },
        {
          kind: "p",
          text: "Attend a visit safely and lawfully. We do not vet the premises you are entering, and we are not responsible for what happens at one, save where the law does not permit us to exclude that.",
        },
      ],
    },
    {
      id: "contact-details",
      heading: "Contact details and how leads work",
      body: [
        {
          kind: "p",
          text: "Your phone number is not published to the agent network, and is not available in bulk to anyone. An agent working an active enquiry of yours can reveal it, subject to a daily limit; every reveal is logged, and you can see who looked and when.",
        },
        {
          kind: "p",
          text: "We do not sell your enquiry to several agents at once. An enquiry is routed to the agent responsible for that inventory.",
        },
        {
          kind: "p",
          text: "If you are an agent, contact details you obtain through the platform may be used only to serve the enquiry they came from. Exporting, retaining beyond that purpose, reselling, or adding them to marketing lists is a breach of these terms and, separately, of data-protection law.",
        },
      ],
    },
    {
      id: "commission",
      heading: "Commission and money",
      body: [
        {
          kind: "p",
          text: "Commission on this platform is calculated by a deterministic engine from published rules. The rules are configuration, not code: they are versioned, and every calculation stores the exact version of the policy it applied, so a payout can always be explained by the rule as it stood on the day it was made. No part of the calculation is decided by a model.",
        },
        {
          kind: "p",
          text: "A ledger entry that has been paid is never rewritten. Corrections are made as reversal and adjustment entries, so the history remains readable.",
        },
        {
          kind: "p",
          text: "Amounts shown on the platform are in Indian rupees. Taxes, including GST where it applies, are your responsibility unless we state otherwise in writing. We may deduct tax at source where the law requires it.",
        },
        {
          kind: "callout",
          text: "Where we hold or route money on behalf of a participant, we do so as an intermediary and not as a bank or a payment system operator. We do not offer investment products, guarantee any return, or accept deposits.",
        },
      ],
    },
    {
      id: "acceptable-use",
      heading: "What you must not do",
      body: [
        {
          kind: "list",
          items: [
            "Publish a listing for a property you are not authorised to market, or one that does not exist.",
            "Post a duplicate of a listing to gain prominence.",
            "Misstate a price, an area, an approval or a possession date.",
            "Claim a verification badge you were not granted, or hold yourself out as verified when you are not.",
            "Scrape, harvest or bulk-extract listings, agents or contact details, by any means including automated ones.",
            "Interfere with the platform's operation, probe it for weaknesses without our written permission, or attempt to reach data that is not yours.",
            "Post anything unlawful, defamatory, discriminatory or that infringes someone's rights — including a review you know to be untrue.",
            "Use the platform to launder money, to evade tax, or to conceal the beneficial ownership of property.",
          ],
        },
        {
          kind: "p",
          text: "Reviews are moderated before publication. We may decline to publish one, and we will not remove a lawful, accurate review merely because its subject objects to it.",
        },
      ],
    },
    {
      id: "content",
      heading: "Content you give us",
      body: [
        {
          kind: "p",
          text: "You keep ownership of what you upload. You give us a non-exclusive, royalty-free licence to host, reproduce, resize and display it for the purpose of operating and promoting the platform, for as long as it is published and for a reasonable period afterwards in our records.",
        },
        {
          kind: "p",
          text: "Do not upload anything you do not have the right to license to us on those terms. If you believe something on the platform infringes your rights, write to us and we will act on a proper notice.",
        },
      ],
    },
    {
      id: "availability",
      heading: "Availability",
      body: [
        {
          kind: "p",
          text: "We work to keep the platform available, but we do not promise it will be uninterrupted or error-free. We may change, suspend or withdraw features. Where a change materially reduces something you rely on, we will give reasonable notice if we can.",
        },
      ],
    },
    {
      id: "liability",
      heading: "Liability",
      body: [
        {
          kind: "p",
          text: "Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else the law does not allow us to limit. Your rights under the Consumer Protection Act, 2019 are not affected.",
        },
        {
          kind: "p",
          text: "Subject to that: we are not liable for a transaction you enter into with another user, for the accuracy of information another user supplied, for a property's condition or title, or for indirect or consequential loss, loss of profit, or loss of opportunity.",
        },
        {
          kind: "p",
          text: "Where we are liable, our total liability to you for all claims in any twelve-month period is limited to the greater of the fees you paid us in that period and ₹10,000.",
        },
        {
          kind: "callout",
          title: "This clause needs your lawyer's eye",
          text: "Limitation and indemnity clauses are the ones most often read down by Indian courts, and the figure above is a placeholder rather than advice. Have it reviewed before you rely on it.",
        },
      ],
    },
    {
      id: "disputes",
      heading: "Complaints, disputes and governing law",
      body: [
        {
          kind: "p",
          text: `Tell us first. The Grievance Redressal page names the officer, the address and the timescales we work to. Most disputes between users about a visit, an attribution or a commission are handled through the platform's own dispute process, which is faster than any court.`,
        },
        {
          kind: "p",
          text: `These terms are governed by the laws of ${legalEntityDetails.governingLaw}. The courts at ${orGap(legalEntityDetails.jurisdiction, "jurisdiction")} have exclusive jurisdiction, save that either of us may seek urgent injunctive relief anywhere.`,
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      body: [
        {
          kind: "p",
          text: "We may amend these terms. The date at the top always says when. Where a change materially affects your rights, we will tell you — by email or in the product — before it takes effect. Continuing to use the platform after that is acceptance; if you do not accept, you may close your account.",
        },
      ],
    },
  ],
};
