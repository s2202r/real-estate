import { appConfig, legalEntityDetails } from "@/config/app";
import { orGap, type LegalDocument } from "@/components/legal/legal-page";

const entity = appConfig.legalEntity;
const app = appConfig.name;

export const privacyDocument: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  summary: `What ${entity} collects when you use ${app}, why, and what you can make us do about it.`,
  updated: "2026-08-31",
  sections: [
    {
      id: "who",
      heading: "Who is responsible for your data",
      body: [
        {
          kind: "p",
          text: `${entity}${
            legalEntityDetails.registrationNumber ? ` (${legalEntityDetails.registrationNumber})` : ""
          }, at ${orGap(legalEntityDetails.registeredAddress, "registered address")}, decides how and why your personal data is processed on ${app}. Under the Digital Personal Data Protection Act, 2023 we are the Data Fiduciary and you are the Data Principal.`,
        },
        {
          kind: "p",
          text: `Questions, requests and complaints about your data go to ${legalEntityDetails.privacyEmail}. If you are not satisfied with the answer, the Grievance Redressal page explains how to escalate, and you may complain to the Data Protection Board of India.`,
        },
      ],
    },
    {
      id: "what-we-collect",
      heading: "What we collect",
      body: [
        {
          kind: "definitions",
          items: [
            {
              term: "Account details",
              text: "Your name, email address, mobile number, the role you signed up as, and your password in hashed form. We never see or store your password in readable form.",
            },
            {
              term: "What you tell the platform",
              text: "Requirements you post, enquiries you send, visits you book, favourites you save, reviews you write, and messages you exchange through the product.",
            },
            {
              term: "Agent and business details",
              text: "For agents: agency name, service areas, languages, experience, RERA registration and the documents uploaded to support verification. For investors: verification documents. These are held for the purpose of verification.",
            },
            {
              term: "Property information",
              text: "What agents publish about a property, and the private parts of it — full address, unit number, owner contact — which are not shown publicly.",
            },
            {
              term: "Location, at check-in",
              text: "If you check in to a site visit, your device's location at that moment, to confirm attendance at the property. We do not collect background or continuous location.",
            },
            {
              term: "Technical data",
              text: "IP address, browser and device type, pages requested, and timestamps. Used to keep the service running, to apply rate limits, and to investigate abuse.",
            },
            {
              term: "Records of access",
              text: "When an agent reveals a customer's contact details, we log who, when and against which enquiry. This is deliberate: it is what lets you see who looked at your details.",
            },
          ],
        },
        {
          kind: "p",
          text: "We do not ask for and do not want financial account numbers, Aadhaar, or any special category of data beyond what a verification document happens to contain. Do not upload documents you have not been asked for.",
        },
      ],
    },
    {
      id: "why",
      heading: "Why we process it",
      body: [
        {
          kind: "list",
          items: [
            "To give you the service you signed up for: an account, search, enquiries, visits, and the workspace for your role.",
            "To verify agents and investors, so that the network means something.",
            "To attribute a transaction correctly and calculate commission from it.",
            "To send you what the service requires — a code to sign in, a visit confirmation, an enquiry update. These are not marketing and you cannot opt out of them while you hold an account.",
            "To keep the platform safe: rate limiting, fraud and duplicate detection, and investigating a complaint.",
            "To meet legal obligations, including tax records and any lawful request we are obliged to answer.",
            "To improve the product, using aggregate counts rather than by reading individual accounts.",
          ],
        },
        {
          kind: "p",
          text: "Marketing messages are sent only if you ask for them, and every one carries a way to stop. You can change what we send you in your notification preferences at any time.",
        },
      ],
    },
    {
      id: "sharing",
      heading: "Who sees it",
      body: [
        {
          kind: "definitions",
          items: [
            {
              term: "Agents, in a limited way",
              text: "An agent working your enquiry sees your name and what you asked for. Your phone number is revealed only against an active enquiry, subject to a daily limit, and every reveal is logged and visible to you. Your number is never exposed to the network in bulk.",
            },
            {
              term: "Other users",
              text: "Your public profile if you are an agent, and any review you publish, under the name on your account.",
            },
            {
              term: "Service providers",
              text: "The companies that host the database, deliver email and SMS, and serve the site. They act on our instructions and may not use your data for their own purposes.",
            },
            {
              term: "Authorities",
              text: "Where we are legally required to disclose, or to establish or defend a legal claim.",
            },
            {
              term: "A buyer of the business",
              text: "If the business is sold or reorganised, on terms that keep this policy's protections in force.",
            },
          ],
        },
        { kind: "p", text: "We do not sell your personal data. We do not sell leads to multiple agents." },
      ],
    },
    {
      id: "storage",
      heading: "Where it is kept, and for how long",
      body: [
        {
          kind: "p",
          text: "Data is held in managed cloud infrastructure. Some providers operate outside India; where data is transferred abroad, it is to a country not restricted under the DPDP Act and under contractual protections.",
        },
        {
          kind: "list",
          items: [
            "Account data: while your account is open, and up to twelve months afterwards, so that a closed account can be restored and a dispute can be answered.",
            "Enquiries, visits and reviews: seven years, because they may be evidence in a commission or consumer dispute.",
            "Financial and commission records: eight years, as tax law requires.",
            "Audit and contact-access logs: seven years. These are append-only and are not edited or deleted on request, because their value is that they cannot be.",
            "Technical logs: usually under ninety days.",
          ],
        },
      ],
    },
    {
      id: "your-rights",
      heading: "Your rights",
      body: [
        {
          kind: "p",
          text: "Under the DPDP Act, 2023 you may ask us to do the following, and we will answer within thirty days.",
        },
        {
          kind: "numbered",
          items: [
            "Tell you what we hold about you and who we have shared it with.",
            "Correct anything inaccurate, or complete anything incomplete. Most of it you can edit yourself in your profile.",
            "Erase what we no longer need. Where a record must be kept — a tax record, an audit log, a live dispute — we will say so and say why.",
            "Nominate someone to exercise these rights if you die or become incapacitated.",
            "Withdraw consent you previously gave. Withdrawing consent for something the service depends on may mean we can no longer provide it.",
            "Complain, first to us and then to the Data Protection Board of India.",
          ],
        },
        {
          kind: "p",
          text: `Write to ${legalEntityDetails.privacyEmail}. We may need to confirm your identity before acting, which is a protection for you rather than an obstacle.`,
        },
      ],
    },
    {
      id: "security",
      heading: "How it is protected",
      body: [
        {
          kind: "list",
          items: [
            "Every row in the database is governed by access rules enforced by the database itself, not only by the application. A query cannot return someone else's data by mistake.",
            "Verification and property documents are held in private storage and are reachable only through short-lived, individually authorised links.",
            "Passwords are hashed by the authentication provider. Sign-in, code requests and code attempts are all rate-limited.",
            "Administrative action is logged to an append-only record with the administrator's identity attached.",
          ],
        },
        {
          kind: "p",
          text: "No system is perfectly secure. If a breach occurs that is likely to affect you, we will notify you and the Data Protection Board as the Act requires.",
        },
      ],
    },
    {
      id: "children",
      heading: "Children",
      body: [
        {
          kind: "p",
          text: "The platform is not for anyone under 18, and we do not knowingly hold a child's data. If you believe a child has registered, tell us and we will remove the account.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      body: [
        {
          kind: "p",
          text: "We will post any change here and update the date at the top. A change that materially affects your rights will be notified to you directly before it takes effect.",
        },
      ],
    },
  ],
};
