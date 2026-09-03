import { appConfig } from "@/config/app";
import type { LegalDocument } from "@/components/legal/legal-page";

const app = appConfig.name;

export const nriGuideDocument: LegalDocument = {
  slug: "nri-guide",
  title: "Buying property in India from abroad",
  summary:
    "What a non-resident needs in place before, during and after a purchase — in outline, not as advice.",
  updated: "2026-09-03",
  sections: [
    {
      id: "scope",
      heading: "What this page is",
      body: [
        {
          kind: "callout",
          title: "General information, not advice",
          text: `This is an outline of the steps non-residents usually go through, written to help you ask your own advisers the right questions. It is not legal, tax or investment advice, ${app} is not your adviser, and none of it is a substitute for a chartered accountant and an advocate who know your circumstances. Rules under FEMA and the Income-tax Act change, and the position for an NRI, an OCI and a foreign national are not the same.`,
        },
      ],
    },
    {
      id: "who-may-buy",
      heading: "Who may buy, and what",
      body: [
        {
          kind: "p",
          text: "Broadly, and subject to your own status: an NRI or a person of Indian origin holding an OCI card may generally acquire residential and commercial immovable property in India. Agricultural land, plantation property and farmhouses are treated differently and generally cannot be acquired — they may only be inherited. A foreign national who is not of Indian origin and is resident outside India generally cannot acquire immovable property without approval.",
        },
        {
          kind: "p",
          text: "Confirm your own category before you commit to anything. The consequence of getting it wrong is not a fee — it is a transaction that may be void.",
        },
      ],
    },
    {
      id: "paying",
      heading: "Paying for it",
      body: [
        {
          kind: "list",
          items: [
            "Payment must come through banking channels: an inward remittance, or from your NRE, NRO or FCNR(B) account. Not in cash, and not from a foreign account directly to a seller.",
            "Keep every remittance advice and bank statement. Repatriation later depends on being able to show how the purchase was funded.",
            "Home loans from Indian lenders are available to non-residents, with repayment expected through the same channels.",
            "Ask your bank what documentation it wants before you transfer, not after.",
          ],
        },
      ],
    },
    {
      id: "power-of-attorney",
      heading: "If you cannot be there",
      body: [
        {
          kind: "p",
          text: "Most non-residents complete a purchase through a power of attorney. It has to be drafted for the specific transaction, and executed and attested properly — typically before the Indian consulate where you live, or notarised and apostilled and then adjudicated in India. A general power of attorney downloaded from the internet is the single most common reason a registration is refused.",
        },
        {
          kind: "p",
          text: `On ${app} you can book a live video visit instead of attending in person: a verified agent walks the property while you watch, and their check-in is recorded at the property. It is a way to see a place honestly from abroad. It is not a survey, and it is not a substitute for an inspection by somebody you instruct yourself.`,
        },
      ],
    },
    {
      id: "diligence",
      heading: "Diligence you should not skip",
      body: [
        {
          kind: "list",
          items: [
            "Title, examined by your own advocate — not by the seller's, and not by ours. Our verification checks that a listing's particulars are complete and supported; it is not a title opinion.",
            "Encumbrance certificate, and the chain of prior deeds.",
            "For an under-construction property: RERA registration, and the approvals and completion timeline registered with the authority.",
            "Property tax receipts, society dues and any outstanding utility liabilities.",
            "Whether the seller is themselves a non-resident, which changes the tax you have to withhold.",
          ],
        },
      ],
    },
    {
      id: "tax",
      heading: "Tax, in outline",
      body: [
        {
          kind: "list",
          items: [
            "Buying from a resident: tax is withheld at source on the consideration above the statutory threshold, and paid against the seller's PAN.",
            "Buying from a non-resident seller: withholding is at a different and considerably higher rate, and you are the person liable for getting it right. Take advice before you pay anything.",
            "Stamp duty and registration charges are levied by the state, not the centre, and vary widely. Budget for them separately from the price.",
            "Rental income from the property is taxable in India, and tax is withheld on rent paid to a non-resident.",
            "On sale, capital gains are taxable in India whatever your residence. Whether relief is available under a double-taxation treaty depends on where you are resident.",
            "A PAN is required. Get it early; it holds up everything else.",
          ],
        },
      ],
    },
    {
      id: "repatriation",
      heading: "Getting the money out again",
      body: [
        {
          kind: "p",
          text: "Sale proceeds may generally be repatriated subject to conditions and annual limits, and on evidence that the purchase was funded through permitted channels in the first place. That evidence is the paperwork you were told to keep at the start. Your bank will want a certificate from a chartered accountant.",
        },
      ],
    },
    {
      id: "on-this-platform",
      heading: "What this platform does and does not do",
      body: [
        {
          kind: "list",
          items: [
            "It shows you a second currency beside every rupee price, at an indicative rate whose date is published. Every transaction is in rupees, and your bank sets the rate you actually pay.",
            "It shows visit times on your own clock as well as the property's, so a slot cannot be misread by five and a half hours.",
            "It lets you book a live video visit with a verified agent instead of travelling.",
            "It does not act for you, advise you, hold your money, or file anything on your behalf.",
          ],
        },
      ],
    },
  ],
};
