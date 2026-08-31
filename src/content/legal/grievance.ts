import { appConfig, legalEntityDetails } from "@/config/app";
import { orGap, type LegalDocument } from "@/components/legal/legal-page";

const app = appConfig.name;

export const grievanceDocument: LegalDocument = {
  slug: "grievance-redressal",
  title: "Grievance Redressal",
  summary: "How to complain, who reads it, and how long we take.",
  updated: "2026-08-31",
  sections: [
    {
      id: "officer",
      heading: "Grievance Officer",
      body: [
        {
          kind: "p",
          text: "Published as required by the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and by the Consumer Protection (E-Commerce) Rules, 2020.",
        },
        {
          kind: "definitions",
          items: [
            {
              term: "Name",
              text: orGap(legalEntityDetails.grievanceOfficerName, "grievance officer"),
            },
            { term: "Email", text: legalEntityDetails.grievanceEmail },
            {
              term: "Postal address",
              text: `${legalEntityDetails.name}, ${orGap(
                legalEntityDetails.registeredAddress,
                "registered address",
              )}`,
            },
            { term: "Hours", text: "Monday to Friday, 10:00–18:00 IST, excluding public holidays." },
          ],
        },
      ],
    },
    {
      id: "what-to-include",
      heading: "What to tell us",
      body: [
        {
          kind: "p",
          text: "A complaint moves faster when it can be identified. Please include:",
        },
        {
          kind: "list",
          items: [
            "Your name and the email address on your account.",
            "The reference of whatever it concerns — a listing reference, a visit, an enquiry, a commission entry, an invoice.",
            "What happened, and what you would like done about it.",
            "Anything that supports it: a screenshot, a message, a document.",
          ],
        },
      ],
    },
    {
      id: "timescales",
      heading: "What happens, and when",
      body: [
        {
          kind: "numbered",
          items: [
            "We acknowledge within 24 hours, with a ticket reference.",
            "We resolve within 15 days. If it is complex, we tell you before that deadline what is holding it up and when to expect an answer.",
            "Content that is unlawful on its face — an obscene image, an impersonation, a listing for a property that does not exist — is removed within 24 hours of a valid report.",
            "A court order or an order from an authorised government agency is acted on within the time the order specifies.",
            "If you are not satisfied, say so and it is escalated internally. We will give you a final written position.",
          ],
        },
      ],
    },
    {
      id: "escalation",
      heading: "If we cannot resolve it",
      body: [
        {
          kind: "list",
          items: [
            "Consumer complaints: the National Consumer Helpline (1915) and the consumer commission with jurisdiction under the Consumer Protection Act, 2019.",
            "Data protection: the Data Protection Board of India, under the Digital Personal Data Protection Act, 2023.",
            "Real-estate regulation: the RERA authority of the state the property is in.",
            "Cybercrime: cybercrime.gov.in, or your local police.",
          ],
        },
        {
          kind: "p",
          text: "Going to any of these does not require our permission, and we will not treat it as a reason to restrict your account.",
        },
      ],
    },
    {
      id: "disputes-between-users",
      heading: "Disputes between users",
      body: [
        {
          kind: "p",
          text: `A disagreement about a visit, an attribution or a commission split is usually better handled inside ${app} than by correspondence: raise a dispute from the record it concerns, and it reaches an administrator with the evidence already attached. Nothing about that process removes any right you have to go elsewhere.`,
        },
      ],
    },
    {
      id: "reporting-content",
      heading: "Reporting a listing or an agent",
      body: [
        {
          kind: "p",
          text: `To report a listing that is fake, duplicated, misdescribed or no longer available, or an agent behaving improperly, write to ${legalEntityDetails.grievanceEmail} with the reference. Reports are investigated, and a listing can be suspended while that happens. We do not tell the subject who reported them.`,
        },
      ],
    },
  ],
};
