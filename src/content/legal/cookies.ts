import { appConfig } from "@/config/app";
import type { LegalDocument } from "@/components/legal/legal-page";

export const cookiesDocument: LegalDocument = {
  slug: "cookies",
  title: "Cookie Policy",
  summary: `The short version: ${appConfig.name} sets two cookies, and neither is for advertising.`,
  updated: "2026-08-31",
  sections: [
    {
      id: "what-we-set",
      heading: "What we set",
      body: [
        {
          kind: "definitions",
          items: [
            {
              term: "Authentication cookies (sb-…)",
              text: "Set when you sign in, by the authentication service. They are what keeps you signed in between pages. They are strictly necessary — without them there is no signed-in session at all. They expire when the session does, or when you sign out.",
            },
            {
              term: "gms_location",
              text: "Remembers the city, locality or project you chose in the header, so the site stays about the place you are looking in rather than resetting on every page. It holds only that choice. You clear it by choosing “All of India” in the same control.",
            },
          ],
        },
        {
          kind: "p",
          text: "That is the entire list. There are no advertising cookies, no third-party trackers, no analytics tags from other companies, and nothing that follows you to other sites.",
        },
      ],
    },
    {
      id: "other-storage",
      heading: "Other things stored on your device",
      body: [
        {
          kind: "definitions",
          items: [
            {
              term: "Service worker cache",
              text: "The app can be installed to your home screen, and caches its icons, fonts and code so it starts quickly and can show an offline page. It deliberately does not cache pages or any response from the API, so nothing about your account is left on a shared device by the cache.",
            },
            {
              term: "Local storage",
              text: "Small interface preferences, such as a panel you collapsed. It never holds personal data and never leaves your browser.",
            },
          ],
        },
      ],
    },
    {
      id: "measurement",
      heading: "How we measure usage",
      body: [
        {
          kind: "p",
          text: "Product analytics are first-party and server-side: we record that an event happened — a search, a listing viewed, a visit requested — in our own database, with sensitive values stripped before they are written. No third party receives it and no cookie is needed for it.",
        },
      ],
    },
    {
      id: "control",
      heading: "Your control",
      body: [
        {
          kind: "p",
          text: "Your browser can block or clear cookies for this site. Blocking the authentication cookies means you will not be able to stay signed in; everything public will still work.",
        },
      ],
    },
  ],
};
